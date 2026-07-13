import * as vscode from 'vscode';
import type { DebugGateway, DataBreakpointRequest } from '../../debug/contracts/DebugGateway.js';
import type { DapCapabilitiesService, ObservedDataBreakpoint } from '../../debug/dap/DapCapabilitiesService.js';
import type { SessionTracker } from '../../debug/contracts/SessionTracker.js';
import type { WatchpointAccessType, WatchpointBackend, WatchpointSnapshot, WatchpointTarget } from '../../protocol/methods.js';
import { ProtocolErrorCode, createProtocolError } from '../../protocol/errors.js';
import { DebugMutationService } from './DebugMutationService.js';

type Candidate = {
	id: string;
	sessionId: string;
	backend: WatchpointBackend;
	target: WatchpointTarget;
	dataId?: string;
	description: string;
	accessTypes: WatchpointAccessType[];
};

/** Owns StackScope session-only watchpoints and preserves observed external DAP entries. */
export class DataWatchpointService implements vscode.Disposable {
	private readonly watchpoints = new Map<string, WatchpointSnapshot[]>();
	private readonly candidates = new Map<string, Candidate>();
	private readonly dataIds = new Map<string, Map<string, string>>();
	private readonly observed = new Map<string, ObservedDataBreakpoint[]>();
	private readonly changeEmitter = new vscode.EventEmitter<{ sessionId: string; watchpoints: WatchpointSnapshot[] }>();
	private readonly hitEmitter = new vscode.EventEmitter<{ sessionId: string; watchpointIds: string[] }>();
	private readonly disposables: vscode.Disposable[];
	readonly onDidChange = this.changeEmitter.event;
	readonly onDidHit = this.hitEmitter.event;

	constructor(
		private readonly sessionTracker: SessionTracker,
		private readonly gateway: DebugGateway,
		private readonly capabilities: DapCapabilitiesService,
		private readonly mutations: DebugMutationService,
		private readonly getSelectedFrameId: (sessionId: string) => number | undefined,
	) {
		this.disposables = [
			capabilities.onDidObserveDataBreakpoints(({ sessionId, breakpoints }) => this.observe(sessionId, breakpoints)),
			vscode.debug.onDidTerminateDebugSession((session) => this.clearSession(session.id)),
			vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
				if (event.event !== 'stopped') {return;}
				const body = event.body as { reason?: unknown; hitBreakpointIds?: unknown } | undefined;
				if ((body?.reason !== 'data breakpoint' && body?.reason !== 'breakpoint') || !Array.isArray(body.hitBreakpointIds)) {return;}
				const ids = new Set(body.hitBreakpointIds.filter((id): id is number => typeof id === 'number'));
				const hit = this.list(event.session.id).filter((watchpoint) => watchpoint.breakpointId !== undefined && ids.has(watchpoint.breakpointId)).map((watchpoint) => watchpoint.id);
				if (hit.length > 0) {this.hitEmitter.fire({ sessionId: event.session.id, watchpointIds: hit });}
			}),
		];
	}

	list(sessionId: string | null): WatchpointSnapshot[] {
		return sessionId ? [...(this.watchpoints.get(sessionId) ?? [])] : [];
	}

	async getCandidate(target: WatchpointTarget): Promise<{ candidateId: string | null; description: string; accessTypes: WatchpointAccessType[]; backend: WatchpointBackend | null }> {
		const state = await this.requireStoppedSession();
		const support = this.capabilities.getDataBreakpointSupport(state.sessionId);
		if (target.kind === 'memory' && !support.memoryRanges) {throw createProtocolError(ProtocolErrorCode.WATCHPOINT_UNSUPPORTED, 'Debugger does not support memory-range watchpoints');}

		let dapFailure: string | undefined;
		if (support.dataBreakpoints && this.gateway.getDataBreakpointInfo && this.gateway.setDataBreakpoints) {
			const info = await this.gateway.getDataBreakpointInfo(state.sessionId, target.kind === 'register'
				? { name: target.expression, frameId: this.getSelectedFrameId(state.sessionId) }
				: { name: target.address, bytes: target.bytes, asAddress: true });
			if (info?.dataId) {
				return this.storeCandidate({ sessionId: state.sessionId, backend: 'dap', target, dataId: info.dataId, description: info.description, accessTypes: info.accessTypes.length > 0 ? info.accessTypes : ['write'] });
			}
			dapFailure = info?.description ?? 'Debugger did not provide a DAP data breakpoint for this target.';
		}

		if (target.kind === 'register' && support.gdbRegisterFallback && this.gateway.createGdbWatchpoint && this.gateway.removeGdbWatchpoint) {
			return this.storeCandidate({
				sessionId: state.sessionId,
				backend: 'gdb',
				target,
				description: dapFailure ? `GDB fallback: ${dapFailure}` : 'GDB register watchpoint',
				accessTypes: ['read', 'write', 'readWrite'],
			});
		}

		if (target.kind === 'memory') {
			return { candidateId: null, description: dapFailure ?? 'Debugger does not support memory-range watchpoints.', accessTypes: [], backend: null };
		}
		throw createProtocolError(ProtocolErrorCode.WATCHPOINT_UNSUPPORTED, dapFailure ?? 'Debugger does not support register watchpoints');
	}

	async create(candidateId: string, accessType: WatchpointAccessType): Promise<WatchpointSnapshot> {
		const candidate = this.candidates.get(candidateId);
		const state = await this.requireStoppedSession();
		if (!candidate || candidate.sessionId !== state.sessionId) {throw createProtocolError(ProtocolErrorCode.WATCHPOINT_UNAVAILABLE, 'Watchpoint candidate expired. Request it again.');}
		if (!candidate.accessTypes.includes(accessType)) {throw createProtocolError(ProtocolErrorCode.WATCHPOINT_UNAVAILABLE, 'Debugger does not support selected watchpoint access.');}
		return this.mutations.run(state.sessionId, async () => {
			const current = await this.requireStoppedSession();
			if (current.sessionId !== candidate.sessionId) {throw createProtocolError(ProtocolErrorCode.NO_ACTIVE_SESSION, 'Debug session changed before watchpoint creation.');}
			const existing = this.list(current.sessionId);
			const duplicate = existing.find((watchpoint) => sameTarget(watchpoint.target, candidate.target));
			if (duplicate) {return duplicate;}
			if (candidate.backend === 'gdb') {
				const created = await this.gateway.createGdbWatchpoint?.(current.sessionId, candidate.target.kind === 'register' ? candidate.target.expression : '', accessType);
				if (!created?.verified || created.breakpointId === null) {
					throw createProtocolError(ProtocolErrorCode.WATCHPOINT_FAILED, created?.message ?? 'GDB did not create a watchpoint.');
				}
				const watchpoint: WatchpointSnapshot = { id: nextId('watch'), target: candidate.target, description: candidate.description, accessType, backend: 'gdb', verified: true, message: created.message, breakpointId: created.breakpointId };
				this.watchpoints.set(current.sessionId, [...existing, watchpoint]);
				this.candidates.delete(candidateId);
				this.changeEmitter.fire({ sessionId: current.sessionId, watchpoints: this.list(current.sessionId) });
				return watchpoint;
			}

			const provisional: WatchpointSnapshot = { id: nextId('watch'), target: candidate.target, description: candidate.description, accessType, backend: 'dap', verified: false };
			this.getDataIds(current.sessionId).set(provisional.id, candidate.dataId ?? '');
			try {
				const applied = await this.applyDap(current.sessionId, [...existing.filter((watchpoint) => watchpoint.backend === 'dap'), provisional]);
				this.candidates.delete(candidateId);
				return applied.find((watchpoint) => watchpoint.id === provisional.id) ?? provisional;
			} catch (error) {
				this.getDataIds(current.sessionId).delete(provisional.id);
				throw error;
			}
		});
	}

	async remove(id: string): Promise<boolean> {
		const state = await this.requireStoppedSession();
		return this.mutations.run(state.sessionId, async () => {
			const existing = this.list(state.sessionId);
			if (!existing.some((watchpoint) => watchpoint.id === id)) {return false;}
			const watchpoint = existing.find((item) => item.id === id);
			if (!watchpoint) {return false;}
			if (watchpoint.backend === 'gdb') {
				const removed = await this.gateway.removeGdbWatchpoint?.(state.sessionId, watchpoint.breakpointId ?? -1);
				if (!removed?.verified) {throw createProtocolError(ProtocolErrorCode.WATCHPOINT_FAILED, removed?.message ?? 'GDB did not remove the watchpoint.');}
				this.watchpoints.set(state.sessionId, existing.filter((item) => item.id !== id));
				this.changeEmitter.fire({ sessionId: state.sessionId, watchpoints: this.list(state.sessionId) });
				return true;
			}
			await this.applyDap(state.sessionId, existing.filter((item) => item.backend === 'dap' && item.id !== id));
			this.getDataIds(state.sessionId).delete(id);
			return true;
		});
	}

	private async applyDap(sessionId: string, next: WatchpointSnapshot[]): Promise<WatchpointSnapshot[]> {
		const previous = this.list(sessionId).filter((watchpoint) => watchpoint.backend === 'dap');
		const dataIds = this.getDataIds(sessionId);
		const previousDataIds = new Set(previous.map((watchpoint) => dataIds.get(watchpoint.id)).filter((value): value is string => Boolean(value)));
		const external = (this.observed.get(sessionId) ?? []).filter((breakpoint) => !previousDataIds.has(breakpoint.dataId));
		const requests: DataBreakpointRequest[] = [
			...external,
			...next.map((watchpoint) => ({ dataId: dataIds.get(watchpoint.id) ?? '', accessType: watchpoint.accessType })),
		];
		if (requests.some((request) => !request.dataId)) {throw createProtocolError(ProtocolErrorCode.WATCHPOINT_CONFLICT, 'External data breakpoint state is unsafe.');}
		if (!this.gateway.setDataBreakpoints) {throw createProtocolError(ProtocolErrorCode.WATCHPOINT_UNSUPPORTED, 'Debugger gateway does not support data breakpoints');}
		const results = await this.gateway.setDataBreakpoints(sessionId, requests);
		if (!results || results.length !== requests.length) {throw createProtocolError(ProtocolErrorCode.WATCHPOINT_FAILED, 'Debugger did not apply data breakpoints.');}
		const offset = external.length;
		const applied = next.map((watchpoint, index) => ({ ...watchpoint, verified: results[offset + index].verified, message: results[offset + index].message, breakpointId: results[offset + index].id }));
		const all = [...this.list(sessionId).filter((watchpoint) => watchpoint.backend === 'gdb'), ...applied];
		this.watchpoints.set(sessionId, all);
		this.changeEmitter.fire({ sessionId, watchpoints: all });
		return all;
	}

	private storeCandidate(candidate: Omit<Candidate, 'id'>): { candidateId: string; description: string; accessTypes: WatchpointAccessType[]; backend: WatchpointBackend } {
		const value: Candidate = { ...candidate, id: nextId('candidate') };
		this.candidates.set(value.id, value);
		return { candidateId: value.id, description: value.description, accessTypes: value.accessTypes, backend: value.backend };
	}

	private observe(sessionId: string, breakpoints: ObservedDataBreakpoint[]): void {
		this.observed.set(sessionId, breakpoints);
	}

	private async requireStoppedSession(): Promise<{ sessionId: string }> {
		const state = await this.sessionTracker.refresh();
		if (!state.sessionId) {throw createProtocolError(ProtocolErrorCode.NO_ACTIVE_SESSION, 'No active debug session');}
		if (state.status !== 'stopped') {throw createProtocolError(ProtocolErrorCode.SESSION_NOT_STOPPED, 'Pause execution before changing watchpoints.');}
		return { sessionId: state.sessionId };
	}

	private clearSession(sessionId: string): void {
		this.watchpoints.delete(sessionId);
		this.observed.delete(sessionId);
		this.dataIds.delete(sessionId);
		for (const [id, candidate] of this.candidates) {if (candidate.sessionId === sessionId) {this.candidates.delete(id);}}
		this.changeEmitter.fire({ sessionId, watchpoints: [] });
	}

	private getDataIds(sessionId: string): Map<string, string> {
		let values = this.dataIds.get(sessionId);
		if (!values) {
			values = new Map();
			this.dataIds.set(sessionId, values);
		}
		return values;
	}

	dispose(): void {
		for (const disposable of this.disposables) {disposable.dispose();}
		this.changeEmitter.dispose();
		this.hitEmitter.dispose();
	}
}

function sameTarget(left: WatchpointTarget, right: WatchpointTarget): boolean {
	return left.kind === right.kind && (left.kind === 'register'
		? right.kind === 'register' && left.expression === right.expression
		: right.kind === 'memory' && left.address === right.address && left.bytes === right.bytes);
}

function nextId(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
