import * as vscode from 'vscode';
import type { DebugGateway } from '../../debug/contracts/DebugGateway.js';
import type { SessionTracker } from '../../debug/contracts/SessionTracker.js';
import type { DocumentRegistry } from '../../domain/documents/DocumentRegistry.js';
import type { EventMap, EventName } from '../../protocol/events.js';
import { ProtocolErrorCode, createProtocolError, normalizeProtocolError } from '../../protocol/errors.js';
import type { ProtocolRequest } from '../../protocol/messages.js';
import type { MethodMap, MethodName } from '../../protocol/methods.js';
import type { PresetService } from '../services/PresetService.js';
import type { RegisterSetService } from '../services/RegisterSetService.js';
import type { StackSelectionService } from '../services/StackSelectionService.js';
import type { ViewStateService } from '../services/ViewStateService.js';
import { MemoryDocumentService } from '../services/MemoryDocumentService.js';
import { reportHostError } from '../services/HostErrorReporter.js';
import { DebugNavigationController } from './DebugNavigationController.js';
import type { DapCapabilitiesService } from '../../debug/dap/DapCapabilitiesService.js';
import type { DebugMutationService } from '../services/DebugMutationService.js';
import { registerDocumentHandlers } from './handlers/registerDocumentHandlers.js';
import { registerNavigationHandlers } from './handlers/registerNavigationHandlers.js';
import { registerRegisterStateHandlers } from './handlers/registerRegisterStateHandlers.js';
import { registerWorkspaceHandlers } from './handlers/registerWorkspaceHandlers.js';
import { registerWatchpointHandlers } from './handlers/registerWatchpointHandlers.js';
import type { DataWatchpointService } from '../services/DataWatchpointService.js';
import type { HandlerRegistry } from './handlers/types.js';

/**
 * Routes typed protocol messages and broadcasts host events to attached webviews.
 */
export class HostMessageRouter {
	private readonly handlers: HandlerRegistry = new Map();
	private readonly webviews = new Map<vscode.Webview, vscode.Disposable>();
	private readonly documentService: MemoryDocumentService;
	private readonly navigation: DebugNavigationController;
	private sessionListenerDispose: (() => void) | null = null;

	constructor(
		private readonly sessionTracker: SessionTracker,
		private readonly debugGateway: DebugGateway,
		documentRegistry: DocumentRegistry,
		private readonly presetService: PresetService,
		private readonly registerSetService: RegisterSetService,
		private readonly stackSelectionService: StackSelectionService,
		private readonly viewStateService: ViewStateService,
		private readonly capabilities: DapCapabilitiesService,
		private readonly debugMutations: DebugMutationService,
		private readonly dataWatchpoints: DataWatchpointService
	) {
		this.navigation = new DebugNavigationController(
			this.sessionTracker,
			this.debugGateway,
			this.stackSelectionService,
			(event, payload) => this.sendEvent(event, payload),
			this.capabilities
		);
		this.documentService = new MemoryDocumentService(
			this.sessionTracker,
			this.debugGateway,
			documentRegistry,
			(sessionId) => this.navigation.getSelectedFrameId(sessionId),
			(payload) => this.sendEvent('documentChanged', payload),
			this.debugMutations
		);
		this.capabilities.onDidChange((sessionId) => this.navigation.handleCapabilitiesChanged(sessionId));
		this.dataWatchpoints.onDidChange(({ watchpoints }) => this.sendEvent('watchpointsChanged', { watchpoints }));
		this.dataWatchpoints.onDidHit(({ watchpointIds }) => this.sendEvent('watchpointHit', { watchpointIds }));
		this.registerHandlers();
	}

	attach(webview: vscode.Webview): void {
		if (this.webviews.has(webview)) {
			return;
		}

		const disposable = webview.onDidReceiveMessage((message) => {
			void this.handleMessage(webview, message);
		});
		this.webviews.set(webview, disposable);

		if (!this.sessionListenerDispose) {
			this.sessionListenerDispose = this.sessionTracker.onStateChanged((state) => {
				this.navigation.handleSessionChanged(state);
			});
		}
	}

	detach(webview?: vscode.Webview): void {
		if (webview) {
			this.webviews.get(webview)?.dispose();
			this.webviews.delete(webview);
		} else {
			for (const disposable of this.webviews.values()) {
				disposable.dispose();
			}
			this.webviews.clear();
		}

		if (this.webviews.size === 0) {
			this.sessionListenerDispose?.();
			this.sessionListenerDispose = null;
		}
	}

	sendEvent<E extends EventName>(event: E, payload: EventMap[E]): void {
		for (const webview of this.webviews.keys()) {
			this.postMessage(webview, { type: 'event', event, payload });
		}
	}

	private registerHandlers(): void {
		registerDocumentHandlers(this.handlers, this.documentService);
		registerWorkspaceHandlers(this.handlers, {
			sessionTracker: this.sessionTracker,
			documentService: this.documentService,
			presetService: this.presetService,
			registerSetService: this.registerSetService,
			viewStateService: this.viewStateService,
			capabilities: this.capabilities,
			dataWatchpoints: this.dataWatchpoints,
		});
		registerRegisterStateHandlers(this.handlers, {
			sessionTracker: this.sessionTracker,
			debugGateway: this.debugGateway,
			registerSetService: this.registerSetService,
			viewStateService: this.viewStateService,
			debugMutations: this.debugMutations,
			getSelectedFrameId: (sessionId) => this.navigation.getSelectedFrameId(sessionId),
		});
		registerNavigationHandlers(this.handlers, this.navigation);
		registerWatchpointHandlers(this.handlers, {
			dataWatchpoints: this.dataWatchpoints,
		});
	}

	private async handleMessage(webview: vscode.Webview, message: unknown): Promise<void> {
		if (!isProtocolRequest(message)) {
			return;
		}

		const request = message as ProtocolRequest<MethodName, unknown>;
		const handler = this.handlers.get(request.method);
		if (!handler) {
			this.postMessage(webview, {
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
			this.postMessage(webview, {
				type: 'response',
				id: request.id,
				success: true,
				result,
			});
		} catch (error) {
			this.postMessage(webview, {
				type: 'response',
				id: request.id,
				success: false,
				error: normalizeProtocolError(error),
			});
		}
	}

	private postMessage(webview: vscode.Webview, message: unknown): void {
		void webview.postMessage(message).then((delivered) => {
			if (!delivered) {
				reportHostError('HostMessageRouter.postMessage', 'Webview rejected message');
			}
		}, (error) => {
			reportHostError('HostMessageRouter.postMessage', error);
		});
	}
}

function isProtocolRequest(message: unknown): message is ProtocolRequest<string, unknown> {
	return (
		typeof message === 'object' &&
		message !== null &&
		'type' in message &&
		(message as { type: unknown }).type === 'request' &&
		'id' in message &&
		'method' in message
	);
}
