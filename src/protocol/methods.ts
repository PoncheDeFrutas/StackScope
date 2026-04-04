import type { MemoryViewConfig } from '../domain/config/MemoryViewConfig.js';

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

/**
 * Persisted webview UI state snapshot.
 */
export interface ViewStateSnapshot {
	currentTarget: string;
	config: MemoryViewConfig;
	showSettings: boolean;
	showRegisterPanel: boolean;
	registerPanelWidth: number;
	registerValueFormat: 'hex' | 'dec' | 'oct' | 'bin' | 'raw';
}

/**
 * Single stack frame for StackScope call stack UI.
 */
export interface StackFrameSnapshot {
	id: number;
	threadId: number;
	name: string;
	sourceName?: string;
	sourcePath?: string;
	line?: number;
	column?: number;
	instructionPointerReference?: string;
}

/**
 * Thread with stack frames for the call stack view.
 */
export interface StackThreadSnapshot {
	id: number;
	name: string;
	frames: StackFrameSnapshot[];
}

/**
 * Current StackScope-owned debugger context selection.
 */
export interface StackSelectionSnapshot {
	threadId: number | null;
	frameId: number | null;
}

export type DebugNavigationMode = 'call-stack' | 'disassembly';

/**
 * Single disassembled instruction for the editor-tab disassembly view.
 */
export interface DisassembledInstructionSnapshot {
	address: string;
	instruction: string;
	instructionBytes?: string;
	symbol?: string;
	sourceName?: string;
	sourcePath?: string;
	line?: number;
	column?: number;
	isCurrent: boolean;
}

/**
 * Current disassembly window around the selected instruction pointer.
 */
export interface DisassemblySnapshot {
	selection: StackSelectionSnapshot;
	frame: StackFrameSnapshot | null;
	instructions: DisassembledInstructionSnapshot[];
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
	viewState: ViewStateSnapshot | null;
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
// View state methods
// ─────────────────────────────────────────────────────────────────────────────

export interface SaveViewStateParams {
	viewState: ViewStateSnapshot;
}

export interface SaveViewStateResult {
	success: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Call stack methods
// ─────────────────────────────────────────────────────────────────────────────

export interface ListCallStackParams {
	/* empty */
}

export interface ListCallStackResult {
	threads: StackThreadSnapshot[];
	selection: StackSelectionSnapshot;
}

export interface SelectStackFrameParams {
	threadId: number;
	frameId: number;
	frameIndex?: number;
	frameName?: string;
	sourcePath?: string;
	line?: number;
	column?: number;
}

export interface SelectStackFrameResult {
	success: boolean;
	selection: StackSelectionSnapshot;
}

export interface GetDisassemblyParams {
	/* empty */
}

export interface GetDisassemblyResult extends DisassemblySnapshot {
	/* alias result */
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
	| 'readRegisters'
	| 'saveViewState'
	| 'listCallStack'
	| 'selectStackFrame'
	| 'getDisassembly';

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
	saveViewState: { params: SaveViewStateParams; result: SaveViewStateResult };
	listCallStack: { params: ListCallStackParams; result: ListCallStackResult };
	selectStackFrame: { params: SelectStackFrameParams; result: SelectStackFrameResult };
	getDisassembly: { params: GetDisassemblyParams; result: GetDisassemblyResult };
}
