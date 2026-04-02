import * as vscode from 'vscode';
import type { ProtocolRequest, ProtocolResponse } from '../../protocol/messages.js';
import type { MethodName, MethodMap } from '../../protocol/methods.js';
import type { EventName, EventMap } from '../../protocol/events.js';
import { ProtocolErrorCode, createProtocolError } from '../../protocol/errors.js';
import type { DebugGateway } from '../../debug/contracts/DebugGateway.js';
import type { SessionTracker } from '../../debug/contracts/SessionTracker.js';
import type { DocumentRegistry } from '../../domain/documents/DocumentRegistry.js';
import { createMemoryDocument } from '../../domain/documents/MemoryDocument.js';
import { generateDocumentId } from '../../shared/ids.js';

type MethodHandler<M extends MethodName> = (
	params: MethodMap[M]['params']
) => Promise<MethodMap[M]['result']>;

/**
 * Routes messages between host and webview.
 * Handles typed request/response protocol and emits events.
 */
export class HostMessageRouter {
	private webview: vscode.Webview | null = null;
	private readonly handlers = new Map<string, MethodHandler<MethodName>>();
	private messageDisposable: vscode.Disposable | null = null;
	private sessionListenerDispose: (() => void) | null = null;

	constructor(
		private readonly sessionTracker: SessionTracker,
		private readonly debugGateway: DebugGateway,
		private readonly documentRegistry: DocumentRegistry
	) {
		this.registerHandlers();
	}

	/**
	 * Attaches the router to a webview.
	 */
	attach(webview: vscode.Webview): void {
		this.detach();
		this.webview = webview;
		this.messageDisposable = webview.onDidReceiveMessage((msg) =>
			this.handleMessage(msg)
		);

		// Forward session state changes to webview
		this.sessionListenerDispose = this.sessionTracker.onStateChanged((state) => {
			this.sendEvent('sessionChanged', {
				session: {
					sessionId: state.sessionId,
					status: state.status,
				},
			});
		});
	}

	/**
	 * Detaches from the current webview.
	 */
	detach(): void {
		this.messageDisposable?.dispose();
		this.messageDisposable = null;
		this.sessionListenerDispose?.();
		this.sessionListenerDispose = null;
		this.webview = null;
	}

	/**
	 * Sends an event to the webview.
	 */
	sendEvent<E extends EventName>(event: E, payload: EventMap[E]): void {
		this.webview?.postMessage({
			type: 'event',
			event,
			payload,
		});
	}

	private registerHandlers(): void {
		// Init handler - refresh session state before returning
		this.handlers.set('init', async () => {
			const state = await this.sessionTracker.refresh();
			const activeDoc = this.documentRegistry.getActive();

			return {
				session: {
					sessionId: state.sessionId,
					status: state.status,
				},
				activeDocument: activeDoc
					? {
							id: activeDoc.id,
							address: activeDoc.address,
							sessionId: activeDoc.sessionId,
						}
					: null,
			};
		});

		// ReadMemory handler - refresh session state before reading
		this.handlers.set('readMemory', async (params) => {
			const { documentId, offset, count } = params as MethodMap['readMemory']['params'];

			const doc = this.documentRegistry.get(documentId);
			if (!doc) {
				throw createProtocolError(
					ProtocolErrorCode.DOCUMENT_NOT_FOUND,
					`Document ${documentId} not found`
				);
			}

			// Refresh session state to get accurate status
			const state = await this.sessionTracker.refresh();
			
			if (!state.sessionId) {
				throw createProtocolError(
					ProtocolErrorCode.NO_ACTIVE_SESSION,
					'No active debug session'
				);
			}

			if (state.status !== 'stopped') {
				throw createProtocolError(
					ProtocolErrorCode.SESSION_NOT_STOPPED,
					'Debug session is not stopped. Pause execution to read memory.'
				);
			}

			const result = await this.debugGateway.readMemory(
				state.sessionId,
				doc.memoryReference,
				offset,
				count
			);

			if (!result) {
				throw createProtocolError(
					ProtocolErrorCode.READ_MEMORY_FAILED,
					'Failed to read memory from debugger'
				);
			}

			return result;
		});

		// OpenDocument handler - resolves target and creates a memory document
		this.handlers.set('openDocument', async (params) => {
			const { target } = params as MethodMap['openDocument']['params'];

			// Refresh session state to get accurate status
			const state = await this.sessionTracker.refresh();

			if (!state.sessionId) {
				throw createProtocolError(
					ProtocolErrorCode.NO_ACTIVE_SESSION,
					'No active debug session'
				);
			}

			if (state.status !== 'stopped') {
				throw createProtocolError(
					ProtocolErrorCode.SESSION_NOT_STOPPED,
					'Debug session is not stopped. Pause execution first.'
				);
			}

			// Resolve the target to a memory reference
			const memoryReference = await this.debugGateway.evaluateForMemoryReference(
				state.sessionId,
				target
			);

			if (!memoryReference) {
				// Determine appropriate error based on target type
				const isRegister = /^\$[a-zA-Z][a-zA-Z0-9]*$/.test(target);
				throw createProtocolError(
					isRegister
						? ProtocolErrorCode.REGISTER_NOT_AVAILABLE
						: ProtocolErrorCode.SYMBOL_NOT_FOUND,
					`Could not resolve "${target}". ${
						isRegister
							? 'Register may not be available in current context.'
							: 'Try a hex address like 0x20000000 or a valid pointer expression.'
					}`
				);
			}

			// Create and register document
			const doc = createMemoryDocument(
				generateDocumentId(),
				target,
				state.sessionId,
				memoryReference
			);

			this.documentRegistry.add(doc);
			this.documentRegistry.setActive(doc.id);

			// Emit document changed event
			this.sendEvent('documentChanged', {
				document: {
					id: doc.id,
					address: doc.address,
					sessionId: doc.sessionId,
				},
			});

			return {
				document: {
					id: doc.id,
					address: doc.address,
					sessionId: doc.sessionId,
				},
			};
		});
	}

	private async handleMessage(msg: unknown): Promise<void> {
		if (!isProtocolRequest(msg)) {
			return;
		}

		const request = msg as ProtocolRequest<MethodName, unknown>;
		const handler = this.handlers.get(request.method);

		if (!handler) {
			this.sendResponse(request.id, {
				type: 'response',
				id: request.id,
				success: false,
				error: createProtocolError(
					ProtocolErrorCode.UNKNOWN_ERROR,
					`Unknown method: ${request.method}`
				),
			});
			return;
		}

		try {
			const result = await handler(request.params as MethodMap[MethodName]['params']);
			this.sendResponse(request.id, {
				type: 'response',
				id: request.id,
				success: true,
				result,
			});
		} catch (err) {
			const error =
				err && typeof err === 'object' && 'code' in err
					? (err as ReturnType<typeof createProtocolError>)
					: createProtocolError(
							ProtocolErrorCode.UNKNOWN_ERROR,
							err instanceof Error ? err.message : 'Unknown error'
						);

			this.sendResponse(request.id, {
				type: 'response',
				id: request.id,
				success: false,
				error,
			});
		}
	}

	private sendResponse(id: string, response: ProtocolResponse<unknown>): void {
		this.webview?.postMessage(response);
	}
}

function isProtocolRequest(msg: unknown): msg is ProtocolRequest<string, unknown> {
	return (
		typeof msg === 'object' &&
		msg !== null &&
		'type' in msg &&
		(msg as { type: unknown }).type === 'request' &&
		'id' in msg &&
		'method' in msg
	);
}
