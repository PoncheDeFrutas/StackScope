import { messageBus } from './WebviewMessageBus.js';
import type {
	InitResult,
	ReadMemoryResult,
	OpenDocumentResult,
	ListPresetsResult,
	SavePresetResult,
	DeletePresetResult,
	ListRegisterSetsResult,
	SaveRegisterSetResult,
	UpdateRegisterSetResult,
	DeleteRegisterSetResult,
	SelectRegisterSetResult,
	ReadRegistersResult,
	RegisterItemSnapshot,
	ViewStateSnapshot,
	SaveViewStateResult,
	ListCallStackResult,
	SelectStackFrameResult,
	GetDisassemblyResult,
} from '../../protocol/methods.js';

/**
 * Typed client for host RPC calls.
 * Provides a clean API for webview components.
 */
export const HostClient = {
	/**
	 * Initializes the webview and gets current state.
	 */
	async init(): Promise<InitResult> {
		return messageBus.request('init', {});
	},

	/**
	 * Reads memory for a document.
	 */
	async readMemory(
		documentId: string,
		offset: number,
		count: number
	): Promise<ReadMemoryResult> {
		return messageBus.request('readMemory', { documentId, offset, count });
	},

	/**
	 * Opens a memory document for the given target.
	 * Target can be: hex address, register ($pc, $sp), or expression.
	 */
	async openDocument(target: string): Promise<OpenDocumentResult> {
		return messageBus.request('openDocument', { target });
	},

	/**
	 * Lists all available presets (builtin + user).
	 */
	async listPresets(): Promise<ListPresetsResult> {
		return messageBus.request('listPresets', {});
	},

	/**
	 * Saves a new user preset.
	 */
	async savePreset(
		name: string,
		target: string,
		description?: string
	): Promise<SavePresetResult> {
		return messageBus.request('savePreset', { name, target, description });
	},

	/**
	 * Deletes a user preset by ID.
	 */
	async deletePreset(id: string): Promise<DeletePresetResult> {
		return messageBus.request('deletePreset', { id });
	},

	// ─────────────────────────────────────────────────────────────────────────
	// Register set methods
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Lists all available register sets (builtin + user).
	 */
	async listRegisterSets(): Promise<ListRegisterSetsResult> {
		return messageBus.request('listRegisterSets', {});
	},

	/**
	 * Saves a new user register set.
	 */
	async saveRegisterSet(
		name: string,
		registers: RegisterItemSnapshot[],
		description?: string
	): Promise<SaveRegisterSetResult> {
		return messageBus.request('saveRegisterSet', { name, registers, description });
	},

	/**
	 * Updates an existing user register set.
	 */
	async updateRegisterSet(
		id: string,
		updates: {
			name?: string;
			registers?: RegisterItemSnapshot[];
			description?: string;
		}
	): Promise<UpdateRegisterSetResult> {
		return messageBus.request('updateRegisterSet', { id, ...updates });
	},

	/**
	 * Deletes a user register set by ID.
	 */
	async deleteRegisterSet(id: string): Promise<DeleteRegisterSetResult> {
		return messageBus.request('deleteRegisterSet', { id });
	},

	/**
	 * Selects a register set by ID.
	 */
	async selectRegisterSet(id: string): Promise<SelectRegisterSetResult> {
		return messageBus.request('selectRegisterSet', { id });
	},

	/**
	 * Reads all registers in the specified set.
	 */
	async readRegisters(setId: string): Promise<ReadRegistersResult> {
		return messageBus.request('readRegisters', { setId });
	},

	/**
	 * Persists current webview UI state.
	 */
	async saveViewState(viewState: ViewStateSnapshot): Promise<SaveViewStateResult> {
		return messageBus.request('saveViewState', { viewState });
	},

	/**
	 * Lists threads and frames for the current stopped session.
	 */
	async listCallStack(): Promise<ListCallStackResult> {
		return messageBus.request('listCallStack', {});
	},

	/**
	 * Selects a frame as the active StackScope debugger context.
	 */
	async selectStackFrame(
		threadId: number,
		frameId: number,
		options?: {
			frameIndex?: number;
			frameName?: string;
			sourcePath?: string;
			line?: number;
			column?: number;
		}
	): Promise<SelectStackFrameResult> {
		return messageBus.request('selectStackFrame', { threadId, frameId, ...options });
	},

	/**
	 * Reads disassembly around the currently selected StackScope frame.
	 */
	async getDisassembly(): Promise<GetDisassemblyResult> {
		return messageBus.request('getDisassembly', {});
	},
};
