import * as vscode from 'vscode';
import type { ProtocolRequest, ProtocolResponse } from '../../protocol/messages.js';
import type {
	MethodName,
	MethodMap,
	StackFrameSnapshot,
	StackSelectionSnapshot,
	StackThreadSnapshot,
} from '../../protocol/methods.js';
import type { EventName, EventMap } from '../../protocol/events.js';
import {
	ProtocolErrorCode,
	createProtocolError,
	normalizeProtocolError,
} from '../../protocol/errors.js';
import type { DebugGateway } from '../../debug/contracts/DebugGateway.js';
import type { SessionTracker } from '../../debug/contracts/SessionTracker.js';
import type { DocumentRegistry } from '../../domain/documents/DocumentRegistry.js';
import type { PresetService } from '../services/PresetService.js';
import type { RegisterSetService } from '../services/RegisterSetService.js';
import type { StackSelectionService } from '../services/StackSelectionService.js';
import type { ViewStateService } from '../services/ViewStateService.js';
import { MemoryDocumentService } from '../services/MemoryDocumentService.js';
import { isBuiltinPreset } from '../../domain/presets/MemoryPreset.js';
import { isBuiltinRegisterSet } from '../../domain/registers/RegisterSet.js';
import { resolveRequestedFrame, toInstructionSnapshots } from './stackNavigation.js';

type MethodHandler<M extends MethodName> = (
	params: MethodMap[M]['params']
) => Promise<MethodMap[M]['result']>;

/**
 * Routes messages between host and one or more webviews.
 * Handles typed request/response protocol and broadcasts events.
 */
export class HostMessageRouter {
	private readonly handlers = new Map<string, MethodHandler<MethodName>>();
	private readonly webviews = new Map<vscode.Webview, vscode.Disposable>();
	private readonly documentService: MemoryDocumentService;
	private sessionListenerDispose: (() => void) | null = null;

	constructor(
		private readonly sessionTracker: SessionTracker,
		private readonly debugGateway: DebugGateway,
		documentRegistry: DocumentRegistry,
		private readonly presetService: PresetService,
		private readonly registerSetService: RegisterSetService,
		private readonly stackSelectionService: StackSelectionService,
		private readonly viewStateService: ViewStateService
	) {
		this.documentService = new MemoryDocumentService(
			this.sessionTracker,
			this.debugGateway,
			documentRegistry,
			(sessionId) => this.getSelectedFrameId(sessionId),
			(payload) => this.sendEvent('documentChanged', payload)
		);
		this.registerHandlers();
	}

	attach(webview: vscode.Webview): void {
		if (this.webviews.has(webview)) {
			return;
		}

		const disposable = webview.onDidReceiveMessage((msg) => {
			void this.handleMessage(webview, msg);
		});
		this.webviews.set(webview, disposable);

		if (!this.sessionListenerDispose) {
			this.sessionListenerDispose = this.sessionTracker.onStateChanged((state) => {
				this.stackSelectionService.clearIfSessionChanged(state.sessionId);
				this.sendEvent('sessionChanged', {
					session: {
						sessionId: state.sessionId,
						status: state.status,
					},
				});
				void this.emitCallStackChanged();
				void this.emitDisassemblyChanged();
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
			void webview.postMessage({
				type: 'event',
				event,
				payload,
			});
		}
	}

	private registerHandlers(): void {
		this.handlers.set('init', async () => {
			const state = await this.sessionTracker.refresh();
			const { activeDocument, documents } = this.documentService.listDocuments();
			const presets = this.presetService.getAll();
			const registerSets = this.registerSetService.getAll();
			const viewState = this.viewStateService.get();

			return {
				session: {
					sessionId: state.sessionId,
					status: state.status,
				},
				activeDocument,
				documents,
				presets: presets.map((p) => ({
					id: p.id,
					name: p.name,
					target: p.target,
					description: p.description,
					isBuiltin: isBuiltinPreset(p),
				})),
				registerSets: registerSets.map((s) => ({
					id: s.id,
					name: s.name,
					registers: s.registers.map((r) => ({
						expression: r.expression,
						label: r.label,
					})),
					description: s.description,
					isBuiltin: isBuiltinRegisterSet(s),
				})),
				selectedRegisterSetId: this.registerSetService.getSelectedId(),
				viewState,
			};
		});

		this.handlers.set('readMemory', (params) =>
			this.documentService.readMemory(params as MethodMap['readMemory']['params'])
		);

		this.handlers.set('openDocument', (params) =>
			this.documentService.openDocument(params as MethodMap['openDocument']['params'])
		);

		this.handlers.set('listDocuments', async () => this.documentService.listDocuments());
		this.handlers.set('selectDocument', async (params) =>
			this.documentService.selectDocument(params as MethodMap['selectDocument']['params'])
		);
		this.handlers.set('closeDocument', async (params) =>
			this.documentService.closeDocument(params as MethodMap['closeDocument']['params'])
		);
		this.handlers.set('updateDocument', async (params) =>
			this.documentService.updateDocument(params as MethodMap['updateDocument']['params'])
		);

		this.handlers.set('listPresets', async () => {
			const presets = this.presetService.getAll();
			return {
				presets: presets.map((p) => ({
					id: p.id,
					name: p.name,
					target: p.target,
					description: p.description,
					isBuiltin: isBuiltinPreset(p),
				})),
			};
		});

		this.handlers.set('savePreset', async (params) => {
			const { name, target, description } = params as MethodMap['savePreset']['params'];
			const preset = this.presetService.save(name, target, description);
			return {
				preset: {
					id: preset.id,
					name: preset.name,
					target: preset.target,
					description: preset.description,
					isBuiltin: false,
				},
			};
		});

		this.handlers.set('deletePreset', async (params) => {
			const { id } = params as MethodMap['deletePreset']['params'];
			return { success: this.presetService.delete(id) };
		});

		this.handlers.set('listRegisterSets', async () => {
			const registerSets = this.registerSetService.getAll();
			return {
				registerSets: registerSets.map((s) => ({
					id: s.id,
					name: s.name,
					registers: s.registers.map((r) => ({
						expression: r.expression,
						label: r.label,
					})),
					description: s.description,
					isBuiltin: isBuiltinRegisterSet(s),
				})),
				selectedId: this.registerSetService.getSelectedId(),
			};
		});

		this.handlers.set('saveRegisterSet', async (params) => {
			const { name, registers, description } = params as MethodMap['saveRegisterSet']['params'];
			const set = this.registerSetService.save(name, registers, description);
			return {
				registerSet: {
					id: set.id,
					name: set.name,
					registers: set.registers.map((r) => ({
						expression: r.expression,
						label: r.label,
					})),
					description: set.description,
					isBuiltin: false,
				},
			};
		});

		this.handlers.set('updateRegisterSet', async (params) => {
			const { id, name, registers, description } = params as MethodMap['updateRegisterSet']['params'];
			const set = this.registerSetService.update(id, { name, registers, description });
			return {
				registerSet: set
					? {
						id: set.id,
						name: set.name,
						registers: set.registers.map((r) => ({
							expression: r.expression,
							label: r.label,
						})),
						description: set.description,
						isBuiltin: isBuiltinRegisterSet(set),
					}
					: null,
			};
		});

		this.handlers.set('deleteRegisterSet', async (params) => {
			const { id } = params as MethodMap['deleteRegisterSet']['params'];
			return { success: this.registerSetService.delete(id) };
		});

		this.handlers.set('selectRegisterSet', async (params) => {
			const { id } = params as MethodMap['selectRegisterSet']['params'];
			return { success: this.registerSetService.select(id) };
		});

		this.handlers.set('readRegisters', async (params) => {
			const { setId } = params as MethodMap['readRegisters']['params'];
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
					'Debug session is not stopped. Pause execution to read registers.'
				);
			}

			const registerSet = this.registerSetService.get(setId);
			if (!registerSet) {
				throw createProtocolError(
					ProtocolErrorCode.UNKNOWN_ERROR,
					`Register set ${setId} not found`
				);
			}

			const expressions = registerSet.registers.map((r) => r.expression);
			const results = await this.debugGateway.readRegisters(
				state.sessionId,
				expressions,
				this.getSelectedFrameId(state.sessionId)
			);

			const values = registerSet.registers.map((reg, index) => {
				const result = results[index] ?? { expression: reg.expression, value: null };
				return {
					expression: reg.expression,
					label: reg.label ?? reg.expression,
					value: result.value,
					error: result.error,
				};
			});

			return { values };
		});

		this.handlers.set('saveViewState', async (params) => {
			const { viewState } = params as MethodMap['saveViewState']['params'];
			await this.viewStateService.save(viewState);
			return { success: true };
		});

		this.handlers.set('listCallStack', async () => this.getCallStackSnapshot());

		this.handlers.set('selectStackFrame', async (params) => {
			const {
				threadId,
				frameId,
				frameIndex,
				frameName,
				sourcePath,
				line,
				column,
			} = params as MethodMap['selectStackFrame']['params'];
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
					'Debug session is not stopped. Pause execution to select a stack frame.'
				);
			}

			const snapshot = await this.getCallStackSnapshot(state.sessionId, false);
			const frame = resolveRequestedFrame(snapshot.threads, {
				threadId,
				frameId,
				frameIndex,
				frameName,
				sourcePath,
				line,
				column,
			});
			if (!frame) {
				throw createProtocolError(
					ProtocolErrorCode.UNKNOWN_ERROR,
					`Stack frame ${frameId} in thread ${threadId} was not found`
				);
			}

			this.stackSelectionService.set(state.sessionId, frame.threadId, frame.id);
			await this.revealFrameSource(frame);

			const selection = this.getSelectionSnapshot();
			this.sendEvent('callStackChanged', {
				threads: snapshot.threads,
				selection,
			});
			await this.emitDisassemblyChanged();

			return {
				success: true,
				selection,
			};
		});

		this.handlers.set('getDisassembly', async () => this.getDisassemblySnapshot());
	}

	private async handleMessage(webview: vscode.Webview, msg: unknown): Promise<void> {
		if (!isProtocolRequest(msg)) {
			return;
		}

		const request = msg as ProtocolRequest<MethodName, unknown>;
		const handler = this.handlers.get(request.method);

		if (!handler) {
			this.sendResponse(webview, request.id, {
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
			this.sendResponse(webview, request.id, {
				type: 'response',
				id: request.id,
				success: true,
				result,
			});
		} catch (err) {
			const error = normalizeProtocolError(err);

			this.sendResponse(webview, request.id, {
				type: 'response',
				id: request.id,
				success: false,
				error,
			});
		}
	}

	private sendResponse(
		webview: vscode.Webview,
		_id: string,
		response: ProtocolResponse<unknown>
	): void {
		void webview.postMessage(response);
	}

	private getSelectionSnapshot(): StackSelectionSnapshot {
		const selection = this.stackSelectionService.get();
		return {
			threadId: selection.threadId,
			frameId: selection.frameId,
		};
	}

	private getSelectedFrameId(sessionId: string): number | undefined {
		const selection = this.stackSelectionService.get();
		if (selection.sessionId === sessionId && selection.frameId !== null) {
			return selection.frameId;
		}
		return undefined;
	}

	private async emitCallStackChanged(): Promise<void> {
		const snapshot = await this.getCallStackSnapshot();
		this.sendEvent('callStackChanged', snapshot);
	}

	private async emitDisassemblyChanged(): Promise<void> {
		const snapshot = await this.getDisassemblySnapshot();
		this.sendEvent('disassemblyChanged', snapshot);
	}

	private async getCallStackSnapshot(
		sessionIdOverride?: string,
		allowAutoSeed: boolean = true
	): Promise<MethodMap['listCallStack']['result']> {
		const state = await this.sessionTracker.refresh();
		const sessionId = sessionIdOverride ?? state.sessionId;

		if (!sessionId || state.status !== 'stopped') {
			if (!sessionId) {
				this.stackSelectionService.clear();
			}
			return {
				threads: [],
				selection: { threadId: null, frameId: null },
			};
		}

		const threads = (await this.debugGateway.listCallStack(sessionId)).map<StackThreadSnapshot>((thread) => ({
			id: thread.id,
			name: thread.name,
			frames: thread.frames.map((frame) => ({
				id: frame.id,
				threadId: frame.threadId,
				name: frame.name,
				sourceName: frame.sourceName,
				sourcePath: frame.sourcePath,
				line: frame.line,
				column: frame.column,
				instructionPointerReference: frame.instructionPointerReference,
			})),
		}));

		const selection = this.resolveSelection(sessionId, threads, allowAutoSeed);
		return { threads, selection };
	}

	private resolveSelection(
		sessionId: string,
		threads: StackThreadSnapshot[],
		allowAutoSeed: boolean
	): StackSelectionSnapshot {
		const current = this.stackSelectionService.get();
		if (current.sessionId === sessionId && current.threadId !== null && current.frameId !== null) {
			const existingFrame = this.findFrame(threads, current.threadId, current.frameId);
			if (existingFrame) {
				return {
					threadId: current.threadId,
					frameId: current.frameId,
				};
			}
		}

		if (!allowAutoSeed) {
			this.stackSelectionService.clear();
			return { threadId: null, frameId: null };
		}

		const activeFrameId = this.getActiveVsCodeFrameId();
		if (activeFrameId !== null) {
			for (const thread of threads) {
				const frame = thread.frames.find((item) => item.id === activeFrameId);
				if (frame) {
					this.stackSelectionService.set(sessionId, thread.id, frame.id);
					return {
						threadId: thread.id,
						frameId: frame.id,
					};
				}
			}
		}

		for (const thread of threads) {
			const frame = thread.frames[0];
			if (frame) {
				this.stackSelectionService.set(sessionId, thread.id, frame.id);
				return {
					threadId: thread.id,
					frameId: frame.id,
				};
			}
		}

		this.stackSelectionService.clear();
		return { threadId: null, frameId: null };
	}

	private getActiveVsCodeFrameId(): number | null {
		const activeFrame = vscode.debug.activeStackItem;
		if (
			activeFrame &&
			typeof activeFrame === 'object' &&
			'frameId' in activeFrame &&
			typeof (activeFrame as { frameId?: unknown }).frameId === 'number'
		) {
			return (activeFrame as { frameId: number }).frameId;
		}
		return null;
	}

	private findFrame(
		threads: StackThreadSnapshot[],
		threadId: number,
		frameId: number
	): StackFrameSnapshot | null {
		const thread = threads.find((item) => item.id === threadId);
		if (!thread) {
			return null;
		}
		return thread.frames.find((frame) => frame.id === frameId) ?? null;
	}

	private async getDisassemblySnapshot(
		sessionIdOverride?: string
	): Promise<MethodMap['getDisassembly']['result']> {
		const stackSnapshot = await this.getCallStackSnapshot(sessionIdOverride);
		const sessionId = sessionIdOverride ?? (await this.sessionTracker.refresh()).sessionId;
		const selection = stackSnapshot.selection;

		if (!sessionId || selection.threadId === null || selection.frameId === null) {
			return {
				selection,
				frame: null,
				instructions: [],
			};
		}

		const frame = this.findFrame(stackSnapshot.threads, selection.threadId, selection.frameId);
		if (!frame) {
			return {
				selection,
				frame: null,
				instructions: [],
			};
		}

		if (!frame.instructionPointerReference) {
			return {
				selection,
				frame,
				instructions: [],
				error: 'The selected frame does not expose an instruction pointer reference.',
			};
		}

		const result = await this.debugGateway.readDisassembly(
			sessionId,
			frame.instructionPointerReference,
			24,
			72
		);

		return {
			selection,
			frame,
			instructions: toInstructionSnapshots(
				result.instructions,
				frame.instructionPointerReference
			),
			error: result.error,
		};
	}

	private async revealFrameSource(frame: StackFrameSnapshot): Promise<void> {
		if (!frame.sourcePath) {
			return;
		}

		try {
			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(frame.sourcePath));
			const line = Math.max(0, (frame.line ?? 1) - 1);
			const column = Math.max(0, (frame.column ?? 1) - 1);
			const selection = new vscode.Range(
				new vscode.Position(line, column),
				new vscode.Position(line, column)
			);

			await vscode.window.showTextDocument(document, {
				preview: false,
				selection,
			});
		} catch (err) {
			console.warn('[HostMessageRouter] Failed to reveal frame source:', err);
		}
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
