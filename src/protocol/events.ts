import type { SessionSnapshot, DocumentSnapshot } from './methods.js';

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
// Event names
// ─────────────────────────────────────────────────────────────────────────────

export type EventName = 'sessionChanged' | 'documentChanged';

/**
 * Maps event names to their payload types.
 */
export interface EventMap {
	sessionChanged: SessionChangedPayload;
	documentChanged: DocumentChangedPayload;
}
