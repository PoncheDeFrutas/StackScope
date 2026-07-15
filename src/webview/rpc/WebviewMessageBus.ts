import {
	isProtocolEvent,
	isProtocolResponse,
	type ProtocolRequest,
	type ProtocolResponse,
	type ProtocolEvent,
} from '../../protocol/messages.js';
import type { MethodName, MethodMap } from '../../protocol/methods.js';
import type { EventName, EventMap } from '../../protocol/events.js';
import {
	ProtocolErrorCode,
	ProtocolRequestError,
	createProtocolError,
} from '../../protocol/errors.js';

declare const acquireVsCodeApi: () => {
	postMessage(message: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
};

type PendingRequest<R> = {
	resolve: (result: R) => void;
	reject: (error: Error) => void;
	timeoutId?: number;
};

type EventListener<E extends EventName> = (payload: EventMap[E]) => void;

/**
 * Message bus for webview <-> host communication.
 * Handles request/response correlation and event dispatch.
 */
export class WebviewMessageBus {
	private readonly vscode = acquireVsCodeApi();
	private readonly pendingRequests = new Map<string, PendingRequest<unknown>>();
	private readonly eventListeners = new Map<string, Set<EventListener<EventName>>>();
	private readonly messageListener = (event: MessageEvent) => this.handleMessage(event.data);
	private disposed = false;

	constructor() {
		window.addEventListener('message', this.messageListener);
	}

	/**
	 * Sends a request to the host and waits for a response.
	 */
	async request<M extends MethodName>(
		method: M,
		params: MethodMap[M]['params'],
		timeoutMs = method === 'readMemory' || method === 'writeMemory' || method === 'writeRegister'
			? 15_000
			: undefined
	): Promise<MethodMap[M]['result']> {
		if (this.disposed) {
			throw new ProtocolRequestError(
				createProtocolError(ProtocolErrorCode.UNKNOWN_ERROR, 'Webview message bus is disposed')
			);
		}
		const id = `req_${crypto.randomUUID()}`;

		const request: ProtocolRequest<M, MethodMap[M]['params']> = {
			type: 'request',
			id,
			method,
			params,
		};

		return new Promise((resolve, reject) => {
			const timeoutId = timeoutMs === undefined
				? undefined
				: window.setTimeout(() => {
					const pending = this.pendingRequests.get(id);
					if (!pending) {
						return;
					}
					this.pendingRequests.delete(id);
					pending.reject(new ProtocolRequestError(
						createProtocolError(
							ProtocolErrorCode.REQUEST_TIMEOUT,
							`Request timed out after ${timeoutMs}ms: ${method}`
						)
					));
				}, timeoutMs);
			this.pendingRequests.set(id, {
				resolve: resolve as (result: unknown) => void,
				reject,
				timeoutId,
			});
			this.vscode.postMessage(request);
		});
	}

	/**
	 * Subscribes to an event from the host.
	 * @returns A function to unsubscribe.
	 */
	on<E extends EventName>(event: E, listener: EventListener<E>): () => void {
		let listeners = this.eventListeners.get(event);
		if (!listeners) {
			listeners = new Set();
			this.eventListeners.set(event, listeners);
		}
		listeners.add(listener as EventListener<EventName>);

		return () => {
			listeners?.delete(listener as EventListener<EventName>);
			if (listeners?.size === 0) {
				this.eventListeners.delete(event);
			}
		};
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		window.removeEventListener('message', this.messageListener);
		const error = new ProtocolRequestError(
			createProtocolError(ProtocolErrorCode.UNKNOWN_ERROR, 'Webview message bus is disposed')
		);
		for (const pending of this.pendingRequests.values()) {
			if (pending.timeoutId !== undefined) {
				window.clearTimeout(pending.timeoutId);
			}
			pending.reject(error);
		}
		this.pendingRequests.clear();
		this.eventListeners.clear();
	}

	private handleMessage(msg: unknown): void {
		if (isProtocolResponse(msg)) {
			this.handleResponse(msg);
		} else if (isProtocolEvent(msg)) {
			this.handleEvent(msg as ProtocolEvent<EventName, unknown>);
		}
	}

	private handleResponse(response: ProtocolResponse<unknown>): void {
		const pending = this.pendingRequests.get(response.id);
		if (!pending) {
			console.warn('[WebviewMessageBus] No pending request for id:', response.id);
			return;
		}

		this.pendingRequests.delete(response.id);
		if (pending.timeoutId !== undefined) {
			window.clearTimeout(pending.timeoutId);
		}

		if (response.success) {
			pending.resolve(response.result);
		} else {
			pending.reject(new ProtocolRequestError(response.error));
		}
	}

	private handleEvent(event: ProtocolEvent<EventName, unknown>): void {
		const listeners = this.eventListeners.get(event.event);
		if (listeners) {
			for (const listener of listeners) {
				listener(event.payload as EventMap[EventName]);
			}
		}
	}
}

// Singleton instance for the webview
export const messageBus = new WebviewMessageBus();
