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

/**
 * Register item snapshot for webview.
 */
export interface RegisterItemSnapshot {
	expression: string;
	label?: string;
}

/**
 * Register set snapshot for webview.
 */
export interface RegisterSetSnapshot {
	id: string;
	name: string;
	registers: RegisterItemSnapshot[];
	description?: string;
	isBuiltin: boolean;
}

/**
 * Register value snapshot after evaluation.
 */
export interface RegisterValueSnapshot {
	expression: string;
	label: string;
	value: string | null;
	error?: string;
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
	registerSets: RegisterSetSnapshot[];
	selectedRegisterSetId: string;
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
// Register set methods
// ─────────────────────────────────────────────────────────────────────────────

export interface ListRegisterSetsParams {
	/* empty */
}

export interface ListRegisterSetsResult {
	registerSets: RegisterSetSnapshot[];
	selectedId: string;
}

export interface SaveRegisterSetParams {
	name: string;
	registers: RegisterItemSnapshot[];
	description?: string;
}

export interface SaveRegisterSetResult {
	registerSet: RegisterSetSnapshot;
}

export interface UpdateRegisterSetParams {
	id: string;
	name?: string;
	registers?: RegisterItemSnapshot[];
	description?: string;
}

export interface UpdateRegisterSetResult {
	registerSet: RegisterSetSnapshot | null;
}

export interface DeleteRegisterSetParams {
	id: string;
}

export interface DeleteRegisterSetResult {
	success: boolean;
}

export interface SelectRegisterSetParams {
	id: string;
}

export interface SelectRegisterSetResult {
	success: boolean;
}

export interface ReadRegistersParams {
	setId: string;
}

export interface ReadRegistersResult {
	values: RegisterValueSnapshot[];
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
	| 'deletePreset'
	| 'listRegisterSets'
	| 'saveRegisterSet'
	| 'updateRegisterSet'
	| 'deleteRegisterSet'
	| 'selectRegisterSet'
	| 'readRegisters';

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
	listRegisterSets: { params: ListRegisterSetsParams; result: ListRegisterSetsResult };
	saveRegisterSet: { params: SaveRegisterSetParams; result: SaveRegisterSetResult };
	updateRegisterSet: { params: UpdateRegisterSetParams; result: UpdateRegisterSetResult };
	deleteRegisterSet: { params: DeleteRegisterSetParams; result: DeleteRegisterSetResult };
	selectRegisterSet: { params: SelectRegisterSetParams; result: SelectRegisterSetResult };
	readRegisters: { params: ReadRegistersParams; result: ReadRegistersResult };
}
