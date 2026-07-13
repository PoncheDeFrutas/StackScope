import type {
	DebugNavigationMode,
	DisassemblySnapshot,
	SessionSnapshot,
	DocumentSnapshot,
	StackSelectionSnapshot,
	StackThreadSnapshot,
	WatchpointSnapshot,
	WatchpointSupportSnapshot,
} from './methods.js';

// ─────────────────────────────────────────────────────────────────────────────
// Session status changed event
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionChangedPayload {
	session: SessionSnapshot;
	memoryWriteSupported: boolean;
	registerWriteSupported: boolean;
	watchpointSupport: WatchpointSupportSnapshot;
}

export interface WatchpointsChangedPayload { watchpoints: WatchpointSnapshot[]; }
export interface WatchpointHitPayload { watchpointIds: string[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Active document changed event
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentChangedPayload {
	document: DocumentSnapshot | null;
	documents: DocumentSnapshot[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Call stack changed event
// ─────────────────────────────────────────────────────────────────────────────

export interface CallStackChangedPayload {
	threads: StackThreadSnapshot[];
	selection: StackSelectionSnapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// Disassembly changed event
// ─────────────────────────────────────────────────────────────────────────────

export interface DisassemblyChangedPayload extends DisassemblySnapshot {
	/* same payload shape */
}

export interface DebugNavigationModeChangedPayload {
	mode: DebugNavigationMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event names
// ─────────────────────────────────────────────────────────────────────────────

export type EventName =
	| 'sessionChanged'
	| 'watchpointsChanged'
	| 'watchpointHit'
	| 'documentChanged'
	| 'callStackChanged'
	| 'disassemblyChanged'
	| 'debugNavigationModeChanged';

/**
 * Maps event names to their payload types.
 */
export interface EventMap {
	sessionChanged: SessionChangedPayload;
	watchpointsChanged: WatchpointsChangedPayload;
	watchpointHit: WatchpointHitPayload;
	documentChanged: DocumentChangedPayload;
	callStackChanged: CallStackChangedPayload;
	disassemblyChanged: DisassemblyChangedPayload;
	debugNavigationModeChanged: DebugNavigationModeChangedPayload;
}
