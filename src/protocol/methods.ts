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

/**
 * Memory preset snapshot for webview.
 */
export interface PresetSnapshot {
	id: string;
	name: string;
	target: string;
	description?: string;
	isBuiltin: boolean;
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
	presets: PresetSnapshot[];
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
	/** 
	 * Memory bytes as array. 
	 * - Numbers (0-255) for readable bytes
	 * - null for unreadable bytes
	 */
	data: (number | null)[];
	/** Actual number of bytes returned (may be less than requested). */
	bytesRead: number;
	/** True if some bytes could not be read. */
	hasUnreadable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenDocument method
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenDocumentParams {
	/**
	 * Target to open. Can be:
	 * - A hex address (e.g., "0x20000000")
	 * - A register name (e.g., "$pc", "$sp", "$lr")
	 * - A symbol/expression (e.g., "main", "&myVariable")
	 */
	target: string;
}

export interface OpenDocumentResult {
	document: DocumentSnapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset methods
// ─────────────────────────────────────────────────────────────────────────────

export interface ListPresetsParams {
	/* empty */
}

export interface ListPresetsResult {
	presets: PresetSnapshot[];
}

export interface SavePresetParams {
	name: string;
	target: string;
	description?: string;
}

export interface SavePresetResult {
	preset: PresetSnapshot;
}

export interface DeletePresetParams {
	id: string;
}

export interface DeletePresetResult {
	success: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Method names (string literal union)
// ─────────────────────────────────────────────────────────────────────────────

export type MethodName = 
	| 'init' 
	| 'readMemory' 
	| 'openDocument'
	| 'listPresets'
	| 'savePreset'
	| 'deletePreset';

/**
 * Maps method names to their param/result types.
 */
export interface MethodMap {
	init: { params: InitParams; result: InitResult };
	readMemory: { params: ReadMemoryParams; result: ReadMemoryResult };
	openDocument: { params: OpenDocumentParams; result: OpenDocumentResult };
	listPresets: { params: ListPresetsParams; result: ListPresetsResult };
	savePreset: { params: SavePresetParams; result: SavePresetResult };
	deletePreset: { params: DeletePresetParams; result: DeletePresetResult };
}
