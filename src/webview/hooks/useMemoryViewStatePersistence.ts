import { useEffect } from 'react';
import type { MemoryViewConfig } from '../../domain/config/MemoryViewConfig.js';
import { messageBus } from '../rpc/WebviewMessageBus.js';

const SAVE_DEBOUNCE_MS = 200;

export function useMemoryViewStatePersistence(
	ready: boolean,
	currentTarget: string,
	config: MemoryViewConfig,
	showSettings: boolean
): void {
	useEffect(() => {
		if (!ready) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			void messageBus.request('saveViewState', { viewState: { currentTarget, config, showSettings } }).catch((error) => {
				console.error('Failed to save memory view state:', error);
			});
		}, SAVE_DEBOUNCE_MS);

		return () => window.clearTimeout(timeoutId);
	}, [ready, currentTarget, config, showSettings]);
}
