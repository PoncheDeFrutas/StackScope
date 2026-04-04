import type {
	DebugNavigationMode,
	DisassemblySnapshot,
	SessionSnapshot,
	DocumentSnapshot,
	StackSelectionSnapshot,
	StackThreadSnapshot,
} from './methods.js';

// ─────────────────────────────────────────────────────────────────────────────
// Session status changed event
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionChangedPayload {
	session: SessionSnapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// Active document changed event
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentChangedPayload {
	document: DocumentSnapshot | null;
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
	| 'documentChanged'
	| 'callStackChanged'
	| 'disassemblyChanged'
	| 'debugNavigationModeChanged';

/**
 * Maps event names to their payload types.
 */
export interface EventMap {
	sessionChanged: SessionChangedPayload;
	documentChanged: DocumentChangedPayload;
	callStackChanged: CallStackChangedPayload;
	disassemblyChanged: DisassemblyChangedPayload;
	debugNavigationModeChanged: DebugNavigationModeChangedPayload;
}
