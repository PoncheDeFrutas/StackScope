/**
 * Session status snapshot for webview.
 */
export interface SessionSnapshot {
	sessionId: string | null;
	status: 'none' | 'running' | 'stopped';
}

/**
 * Memory document snapshot for webview.
 */
export interface DocumentSnapshot {
	id: string;
	address: string;
	sessionId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Init method
// ─────────────────────────────────────────────────────────────────────────────

export interface InitParams {
	/* empty for now */
}

export interface InitResult {
	session: SessionSnapshot;
	activeDocument: DocumentSnapshot | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ReadMemory method
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadMemoryParams {
	documentId: string;
	offset: number;
	count: number;
}

export interface ReadMemoryResult {
	/** Base address that was read (hex string). */
	address: string;
	/** Memory bytes as array of numbers (0-255). */
	data: number[];
	/** Actual number of bytes returned (may be less than requested). */
	bytesRead: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Method names (string literal union)
// ─────────────────────────────────────────────────────────────────────────────

export type MethodName = 'init' | 'readMemory';

/**
 * Maps method names to their param/result types.
 */
export interface MethodMap {
	init: { params: InitParams; result: InitResult };
	readMemory: { params: ReadMemoryParams; result: ReadMemoryResult };
}
