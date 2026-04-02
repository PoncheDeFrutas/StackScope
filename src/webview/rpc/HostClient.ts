import { messageBus } from './WebviewMessageBus.js';
import type {
	InitResult,
	ReadMemoryResult,
	OpenDocumentResult,
	ListPresetsResult,
	SavePresetResult,
	DeletePresetResult,
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
};
