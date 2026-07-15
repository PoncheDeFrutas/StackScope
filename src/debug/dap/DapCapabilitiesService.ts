import * as vscode from 'vscode';

type CapabilityState = 'unknown' | 'supported' | 'unsupported';
type Operation = 'readMemory' | 'writeMemory' | 'disassemble' | 'evaluate' | 'setExpression' | 'dataBreakpoints' | 'dataBreakpointBytes';
type Snapshot = {
	adapterType: string;
	gdbFallback: boolean;
	initialization: 'unknown' | 'received';
	operations: Record<Operation, { state: CapabilityState; source?: string; reason?: string }>;
};

interface DebugWriteSupport {
	memory: boolean;
	register: boolean;
}

interface DataBreakpointSupport {
	dataBreakpoints: boolean;
	memoryRanges: boolean;
	gdbRegisterFallback: boolean;
}

export interface ObservedDataBreakpoint {
	dataId: string;
	accessType?: 'read' | 'write' | 'readWrite';
}

/** Tracks DAP initialize capabilities and definite unsupported responses. */
export class DapCapabilitiesService implements vscode.DebugAdapterTrackerFactory, vscode.Disposable {
	private readonly snapshots = new Map<string, Snapshot>();
	private readonly requests = new Map<string, Map<number, string>>();
	private readonly changeEmitter = new vscode.EventEmitter<string>();
	private readonly dataBreakpointEmitter = new vscode.EventEmitter<{ sessionId: string; breakpoints: ObservedDataBreakpoint[] }>();
	private readonly disposable: vscode.Disposable;
	readonly onDidChange = this.changeEmitter.event;
	readonly onDidObserveDataBreakpoints = this.dataBreakpointEmitter.event;

	constructor() {
		this.disposable = vscode.debug.registerDebugAdapterTrackerFactory('*', this);
	}

	createDebugAdapterTracker(session: vscode.DebugSession): vscode.DebugAdapterTracker {
		this.ensure(session.id, session.type, session.configuration);
		this.changeEmitter.fire(session.id);
		return {
			onWillReceiveMessage: (message: unknown) => this.noteRequest(session.id, message),
			onDidSendMessage: (message: unknown) => this.noteResponse(session.id, message),
			onWillStopSession: () => {
				this.snapshots.delete(session.id);
				this.requests.delete(session.id);
			},
		};
	}

	supportsWriteMemory(sessionId: string): boolean {
		return this.get(sessionId).operations.writeMemory.state === 'supported';
	}

	supportsSetExpression(sessionId: string): boolean {
		return this.get(sessionId).operations.setExpression.state === 'supported';
	}

	supportsDataBreakpoints(sessionId: string): boolean {
		return this.get(sessionId).operations.dataBreakpoints.state === 'supported';
	}

	getDataBreakpointSupport(sessionId: string): DataBreakpointSupport {
		return {
			dataBreakpoints: this.supportsDataBreakpoints(sessionId),
			memoryRanges: this.get(sessionId).operations.dataBreakpointBytes.state === 'supported',
			gdbRegisterFallback: this.supportsGdbFallback(sessionId),
		};
	}

	supportsGdbFallback(sessionId: string): boolean {
		return this.get(sessionId).gdbFallback;
	}

	getWriteSupport(sessionId: string): DebugWriteSupport {
		const fallback = this.supportsGdbFallback(sessionId);
		return {
			memory: this.supportsWriteMemory(sessionId) || fallback,
			register: this.supportsSetExpression(sessionId) || fallback,
		};
	}

	private get(sessionId: string): Snapshot {
		return this.snapshots.get(sessionId) ?? emptySnapshot('unknown');
	}

	dispose(): void {
		this.disposable.dispose();
		this.changeEmitter.dispose();
		this.dataBreakpointEmitter.dispose();
		this.snapshots.clear();
		this.requests.clear();
	}

	private ensure(sessionId: string, adapterType: string, configuration?: vscode.DebugConfiguration): Snapshot {
		let snapshot = this.snapshots.get(sessionId);
		if (!snapshot) {
			snapshot = emptySnapshot(adapterType, configuration);
			this.snapshots.set(sessionId, snapshot);
		}
		return snapshot;
	}

	private noteRequest(sessionId: string, message: unknown): void {
		if (!isRequest(message)) {
			return;
		}
		let requests = this.requests.get(sessionId);
		if (!requests) { requests = new Map(); this.requests.set(sessionId, requests); }
		requests.set(message.seq, message.command);
		if (message.command === 'setDataBreakpoints') {
			const breakpoints = getObservedDataBreakpoints(message);
			if (breakpoints) {
				this.dataBreakpointEmitter.fire({ sessionId, breakpoints });
			}
		}
	}

	private noteResponse(sessionId: string, message: unknown): void {
		if (isCapabilitiesEvent(message)) {
			if (this.applyCapabilities(this.ensure(sessionId, 'unknown'), message.body.capabilities, 'capabilities-event')) {
				this.changeEmitter.fire(sessionId);
			}
			return;
		}
		if (!isResponse(message)) {
			return;
		}
		const command = this.requests.get(sessionId)?.get(message.request_seq);
		if (command === 'initialize' && message.success) {
			const snapshot = this.ensure(sessionId, 'unknown');
			snapshot.initialization = 'received';
			if (this.applyCapabilities(snapshot, message.body?.capabilities ?? message.body ?? {}, 'initialize')) {
				this.changeEmitter.fire(sessionId);
			}
		} else if (command && !message.success && /method not found|unsupported|not supported/i.test(String(message.message ?? ''))) {
			const operation = commandToOperation(command);
			if (operation) {
				const snapshot = this.ensure(sessionId, 'unknown');
				if (snapshot.operations[operation].state !== 'unsupported') {
					snapshot.operations[operation] = { state: 'unsupported', source: 'response', reason: String(message.message) };
					this.changeEmitter.fire(sessionId);
				}
			}
		}
	}

	private applyCapabilities(snapshot: Snapshot, capabilities: Record<string, unknown>, source: string): boolean {
		let changed = false;
		const map: Array<[Operation, string]> = [['readMemory', 'supportsReadMemoryRequest'], ['writeMemory', 'supportsWriteMemoryRequest'], ['disassemble', 'supportsDisassembleRequest'], ['setExpression', 'supportsSetExpression'], ['dataBreakpoints', 'supportsDataBreakpoints'], ['dataBreakpointBytes', 'supportsDataBreakpointBytes']];
		for (const [operation, field] of map) {
			if (typeof capabilities[field] === 'boolean') {
				const nextState: CapabilityState = capabilities[field] ? 'supported' : 'unsupported';
				if (snapshot.operations[operation].state !== nextState) {
					snapshot.operations[operation] = { state: nextState, source, reason: undefined };
					changed = true;
				}
			}
		}
		return changed;
	}
}

function emptySnapshot(adapterType: string, configuration?: vscode.DebugConfiguration): Snapshot {
	const unknown = (): { state: CapabilityState } => ({ state: 'unknown' });
	return { adapterType, gdbFallback: isGdbFallback(adapterType, configuration), initialization: 'unknown', operations: { readMemory: unknown(), writeMemory: unknown(), disassemble: unknown(), evaluate: unknown(), setExpression: unknown(), dataBreakpoints: unknown(), dataBreakpointBytes: unknown() } };
}

function isGdbFallback(adapterType: string, configuration?: vscode.DebugConfiguration): boolean {
	if (adapterType === 'cortex-debug') {return true;}
	if (adapterType !== 'cppdbg') {return false;}
	const miMode = configuration?.MIMode;
	if (typeof miMode === 'string') {return miMode.toLowerCase() === 'gdb';}
	const debuggerPath = configuration?.miDebuggerPath;
	return typeof debuggerPath === 'string' && /(?:^|[/\\])gdb(?:-|$)/i.test(debuggerPath);
}
function isRequest(value: unknown): value is { type: 'request'; seq: number; command: string; arguments?: unknown } { return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'request' && Number.isInteger((value as { seq?: unknown }).seq) && typeof (value as { command?: unknown }).command === 'string'; }
function isResponse(value: unknown): value is { type: 'response'; request_seq: number; success: boolean; body?: { capabilities?: Record<string, unknown> } & Record<string, unknown>; message?: unknown } { return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'response' && Number.isInteger((value as { request_seq?: unknown }).request_seq) && typeof (value as { success?: unknown }).success === 'boolean'; }
function isCapabilitiesEvent(value: unknown): value is { type: 'event'; event: 'capabilities'; body: { capabilities: Record<string, unknown> } } { return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'event' && (value as { event?: unknown }).event === 'capabilities' && typeof (value as { body?: unknown }).body === 'object' && (value as { body: { capabilities?: unknown } }).body.capabilities !== null; }
function commandToOperation(command: string): Operation | null { return command === 'readMemory' ? 'readMemory' : command === 'writeMemory' ? 'writeMemory' : command === 'disassemble' ? 'disassemble' : command === 'evaluate' ? 'evaluate' : command === 'setExpression' ? 'setExpression' : command === 'dataBreakpointInfo' || command === 'setDataBreakpoints' ? 'dataBreakpoints' : null; }

function getObservedDataBreakpoints(message: { arguments?: unknown }): ObservedDataBreakpoint[] | null {
	const values = (message.arguments as { breakpoints?: unknown } | undefined)?.breakpoints;
	if (!Array.isArray(values)) {return null;}
	const result: ObservedDataBreakpoint[] = [];
	for (const value of values) {
		if (!value || typeof value !== 'object' || typeof (value as { dataId?: unknown }).dataId !== 'string') {continue;}
		const accessType = (value as { accessType?: unknown }).accessType;
		result.push({ dataId: (value as { dataId: string }).dataId, accessType: accessType === 'read' || accessType === 'write' || accessType === 'readWrite' ? accessType : undefined });
	}
	return result;
}
