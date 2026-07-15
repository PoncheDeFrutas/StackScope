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
	displayName: string;
	sessionId: string;
	config: MemoryViewConfig;
}

/**
 * Memory preset snapshot for webview.
 */
export interface PresetSnapshot {
	id: string;
	name: string;
	target: string;
	description?: string;
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

/** State owned by the memory webview. */
export interface MemoryViewState {
	currentTarget: string;
	config: MemoryViewConfig;
	showSettings: boolean;
}

export type RegisterValueFormat = 'hex' | 'dec' | 'oct' | 'bin' | 'raw';

/** State owned by the Registers webview. */
export interface RegisterViewState {
	registerValueFormat: RegisterValueFormat;
	registersExpanded: boolean;
	watchpointsExpanded: boolean;
}

/**
 * Persisted workspace state. Legacy panel fields remain readable for existing workspaces.
 */
export interface ViewStateSnapshot extends MemoryViewState, RegisterViewState {
	showRegisterPanel: boolean;
	registerPanelWidth: number;
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
	documents: DocumentSnapshot[];
	presets: PresetSnapshot[];
	registerSets: RegisterSetSnapshot[];
	selectedRegisterSetId: string;
	viewState: ViewStateSnapshot | null;
	memoryWriteSupported: boolean;
	registerWriteSupported: boolean;
	watchpointSupport: WatchpointSupportSnapshot;
	watchpoints: WatchpointSnapshot[];
}

export type WatchpointAccessType = 'read' | 'write' | 'readWrite';

export type WatchpointTarget =
	| { kind: 'register'; expression: string; label: string }
	| { kind: 'memory'; address: string; bytes: number };

export interface WatchpointSupportSnapshot {
	dataBreakpoints: boolean;
	memoryRanges: boolean;
	gdbRegisterFallback: boolean;
}

export type WatchpointBackend = 'dap' | 'gdb';

export interface WatchpointSnapshot {
	id: string;
	target: WatchpointTarget;
	description: string;
	accessType: WatchpointAccessType;
	verified: boolean;
	backend: WatchpointBackend;
	message?: string;
	breakpointId?: number;
}

export interface GetWatchpointCandidateParams { target: WatchpointTarget; }
export interface GetWatchpointCandidateResult { candidateId: string | null; description: string; accessTypes: WatchpointAccessType[]; backend: WatchpointBackend | null; }
export interface CreateWatchpointParams { candidateId: string; accessType: WatchpointAccessType; }
export interface CreateWatchpointResult { watchpoint: WatchpointSnapshot; }
export interface RemoveWatchpointParams { id: string; }
export interface RemoveWatchpointResult { success: boolean; }

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

export interface WriteMemoryParams { documentId: string; offset: number; data: number[]; }
export interface WriteMemoryResult { offset: number; bytesWritten: number; partial: boolean; verification: ReadMemoryResult; verified: boolean; }
export interface WriteRegisterParams { expression: string; value: string; }
export interface WriteRegisterResult { value: string; readBackValue: string | null; readBackAvailable: boolean; }

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
	displayName?: string;
	config?: MemoryViewConfig;
}

export interface OpenDocumentResult {
	document: DocumentSnapshot;
	documents: DocumentSnapshot[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Document methods
// ─────────────────────────────────────────────────────────────────────────────

export interface ListDocumentsParams {
	/* empty */
}

export interface ListDocumentsResult {
	documents: DocumentSnapshot[];
	activeDocument: DocumentSnapshot | null;
}

export interface SelectDocumentParams {
	id: string;
}

export interface SelectDocumentResult {
	document: DocumentSnapshot;
	documents: DocumentSnapshot[];
}

export interface CloseDocumentParams {
	id: string;
}

export interface CloseDocumentResult {
	activeDocument: DocumentSnapshot | null;
	documents: DocumentSnapshot[];
}

export interface UpdateDocumentParams {
	id: string;
	displayName?: string;
	config?: MemoryViewConfig;
}

export interface UpdateDocumentResult {
	document: DocumentSnapshot;
	documents: DocumentSnapshot[];
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
	viewState: MemoryViewState;
}

export interface SaveViewStateResult {
	success: boolean;
}

export interface SaveRegisterViewStateParams {
	registerValueFormat: RegisterViewState['registerValueFormat'];
	registersExpanded?: boolean;
	watchpointsExpanded?: boolean;
}

export interface SaveRegisterViewStateResult {
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

/**
 * Maps method names to their param/result types.
 */
export interface MethodMap {
	init: { params: InitParams; result: InitResult };
	readMemory: { params: ReadMemoryParams; result: ReadMemoryResult };
	writeMemory: { params: WriteMemoryParams; result: WriteMemoryResult };
	writeRegister: { params: WriteRegisterParams; result: WriteRegisterResult };
	getWatchpointCandidate: { params: GetWatchpointCandidateParams; result: GetWatchpointCandidateResult };
	createWatchpoint: { params: CreateWatchpointParams; result: CreateWatchpointResult };
	removeWatchpoint: { params: RemoveWatchpointParams; result: RemoveWatchpointResult };
	openDocument: { params: OpenDocumentParams; result: OpenDocumentResult };
	listDocuments: { params: ListDocumentsParams; result: ListDocumentsResult };
	selectDocument: { params: SelectDocumentParams; result: SelectDocumentResult };
	closeDocument: { params: CloseDocumentParams; result: CloseDocumentResult };
	updateDocument: { params: UpdateDocumentParams; result: UpdateDocumentResult };
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
	saveRegisterViewState: {
		params: SaveRegisterViewStateParams;
		result: SaveRegisterViewStateResult;
	};
	listCallStack: { params: ListCallStackParams; result: ListCallStackResult };
	selectStackFrame: { params: SelectStackFrameParams; result: SelectStackFrameResult };
	getDisassembly: { params: GetDisassemblyParams; result: GetDisassemblyResult };
}

export type MethodName = keyof MethodMap;
