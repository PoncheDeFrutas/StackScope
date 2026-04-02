import { messageBus } from './WebviewMessageBus.js';
import type { InitResult, ReadMemoryResult } from '../../protocol/methods.js';

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
};
