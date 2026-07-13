import * as vscode from 'vscode';
import type { DebugGateway } from '../../debug/contracts/DebugGateway.js';
import type { SessionState, SessionTracker } from '../../debug/contracts/SessionTracker.js';
import type { DapCapabilitiesService } from '../../debug/dap/DapCapabilitiesService.js';
import type { EventMap, EventName } from '../../protocol/events.js';
import { ProtocolErrorCode, createProtocolError } from '../../protocol/errors.js';
import type {
	MethodMap,
	StackFrameSnapshot,
	StackSelectionSnapshot,
	StackThreadSnapshot,
} from '../../protocol/methods.js';
import type { StackSelectionService } from '../services/StackSelectionService.js';
import { reportHostError } from '../services/HostErrorReporter.js';
import { resolveRequestedFrame, toInstructionSnapshots } from './stackNavigation.js';

type EventEmitter = <E extends EventName>(event: E, payload: EventMap[E]) => void;

/**
 * Owns StackScope call-stack selection, disassembly snapshots, and navigation events.
 */
export class DebugNavigationController {
	constructor(
		private readonly sessionTracker: SessionTracker,
		private readonly debugGateway: DebugGateway,
		private readonly stackSelectionService: StackSelectionService,
		private readonly sendEvent: EventEmitter,
		private readonly capabilities?: DapCapabilitiesService
	) {}

	handleSessionChanged(state: SessionState): void {
		this.stackSelectionService.clearIfSessionChanged(state.sessionId);
		this.emitSessionChanged(state);
		void this.emitCallStackChanged();
		void this.emitDisassemblyChanged();
	}

	handleCapabilitiesChanged(sessionId: string): void {
		const state = this.sessionTracker.getState();
		if (state.sessionId === sessionId) {
			this.emitSessionChanged(state);
		}
	}

	private emitSessionChanged(state: SessionState): void {
		const support = state.sessionId ? this.capabilities?.getWriteSupport(state.sessionId) : undefined;
		const watchpointSupport = state.sessionId ? this.capabilities?.getDataBreakpointSupport(state.sessionId) : undefined;
		this.sendEvent('sessionChanged', {
			session: { sessionId: state.sessionId, status: state.status },
			memoryWriteSupported: support?.memory ?? false,
			registerWriteSupported: support?.register ?? false,
			watchpointSupport: watchpointSupport ?? { dataBreakpoints: false, memoryRanges: false, gdbRegisterFallback: false },
		});
	}

	getSelectionSnapshot(): StackSelectionSnapshot {
		const selection = this.stackSelectionService.get();
		return { threadId: selection.threadId, frameId: selection.frameId };
	}

	getSelectedFrameId(sessionId: string): number | undefined {
		const selection = this.stackSelectionService.get();
		return selection.sessionId === sessionId && selection.frameId !== null
			? selection.frameId
			: undefined;
	}

	async getCallStackSnapshot(
		sessionIdOverride?: string,
		allowAutoSeed: boolean = true
	): Promise<MethodMap['listCallStack']['result']> {
		const state = await this.sessionTracker.refresh();
		const sessionId = sessionIdOverride ?? state.sessionId;

		if (!sessionId || state.status !== 'stopped') {
			if (!sessionId) {
				this.stackSelectionService.clear();
			}
			return { threads: [], selection: { threadId: null, frameId: null } };
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

		return {
			threads,
			selection: this.resolveSelection(sessionId, threads, allowAutoSeed),
		};
	}

	async selectStackFrame(
		params: MethodMap['selectStackFrame']['params']
	): Promise<MethodMap['selectStackFrame']['result']> {
		const state = await this.sessionTracker.refresh();
		if (!state.sessionId) {
			throw createProtocolError(ProtocolErrorCode.NO_ACTIVE_SESSION, 'No active debug session');
		}
		if (state.status !== 'stopped') {
			throw createProtocolError(
				ProtocolErrorCode.SESSION_NOT_STOPPED,
				'Debug session is not stopped. Pause execution to select a stack frame.'
			);
		}

		const snapshot = await this.getCallStackSnapshot(state.sessionId, false);
		const frame = resolveRequestedFrame(snapshot.threads, params);
		if (!frame) {
			throw createProtocolError(
				ProtocolErrorCode.UNKNOWN_ERROR,
				`Stack frame ${params.frameId} in thread ${params.threadId} was not found`
			);
		}

		this.stackSelectionService.set(state.sessionId, frame.threadId, frame.id);
		await this.revealFrameSource(frame);

		const selection = this.getSelectionSnapshot();
		this.sendEvent('callStackChanged', { threads: snapshot.threads, selection });
		await this.emitDisassemblyChanged();
		return { success: true, selection };
	}

	async getDisassemblySnapshot(
		sessionIdOverride?: string
	): Promise<MethodMap['getDisassembly']['result']> {
		const stackSnapshot = await this.getCallStackSnapshot(sessionIdOverride);
		const sessionId = sessionIdOverride ?? (await this.sessionTracker.refresh()).sessionId;
		const selection = stackSnapshot.selection;

		if (!sessionId || selection.threadId === null || selection.frameId === null) {
			return { selection, frame: null, instructions: [] };
		}

		const frame = this.findFrame(stackSnapshot.threads, selection.threadId, selection.frameId);
		if (!frame) {
			return { selection, frame: null, instructions: [] };
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
			instructions: toInstructionSnapshots(result.instructions, frame.instructionPointerReference),
			error: result.error,
		};
	}

	private async emitCallStackChanged(): Promise<void> {
		this.sendEvent('callStackChanged', await this.getCallStackSnapshot());
	}

	private async emitDisassemblyChanged(): Promise<void> {
		this.sendEvent('disassemblyChanged', await this.getDisassemblySnapshot());
	}

	private resolveSelection(
		sessionId: string,
		threads: StackThreadSnapshot[],
		allowAutoSeed: boolean
	): StackSelectionSnapshot {
		const current = this.stackSelectionService.get();
		if (current.sessionId === sessionId && current.threadId !== null && current.frameId !== null) {
			if (this.findFrame(threads, current.threadId, current.frameId)) {
				return { threadId: current.threadId, frameId: current.frameId };
			}
		}
		if (!allowAutoSeed) {
			this.stackSelectionService.clear();
			return { threadId: null, frameId: null };
		}

		const activeFrameId = this.getActiveVsCodeFrameId();
		for (const thread of threads) {
			const frame = thread.frames.find((item) => item.id === activeFrameId) ?? thread.frames[0];
			if (frame) {
				this.stackSelectionService.set(sessionId, thread.id, frame.id);
				return { threadId: thread.id, frameId: frame.id };
			}
		}

		this.stackSelectionService.clear();
		return { threadId: null, frameId: null };
	}

	private getActiveVsCodeFrameId(): number | null {
		const activeFrame = vscode.debug.activeStackItem;
		return activeFrame &&
			typeof activeFrame === 'object' &&
			'frameId' in activeFrame &&
			typeof (activeFrame as { frameId?: unknown }).frameId === 'number'
			? (activeFrame as { frameId: number }).frameId
			: null;
	}

	private findFrame(
		threads: StackThreadSnapshot[],
		threadId: number,
		frameId: number
	): StackFrameSnapshot | null {
		const thread = threads.find((item) => item.id === threadId);
		return thread?.frames.find((frame) => frame.id === frameId) ?? null;
	}

	private async revealFrameSource(frame: StackFrameSnapshot): Promise<void> {
		if (!frame.sourcePath) {
			return;
		}
		try {
			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(frame.sourcePath));
			const line = Math.max(0, (frame.line ?? 1) - 1);
			const column = Math.max(0, (frame.column ?? 1) - 1);
			const position = new vscode.Position(line, column);
			await vscode.window.showTextDocument(document, {
				preview: false,
				selection: new vscode.Range(position, position),
			});
		} catch (error) {
			reportHostError('DebugNavigationController.revealFrameSource', error);
		}
	}
}
