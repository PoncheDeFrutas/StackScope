import { useCallback, useState } from 'react';
import type {
	WatchpointAccessType,
	WatchpointBackend,
	WatchpointSnapshot,
	WatchpointTarget,
} from '../../protocol/methods.js';
import { messageBus } from '../rpc/WebviewMessageBus.js';

interface WatchpointDialogState {
	target: WatchpointTarget;
	candidateId: string;
	description: string;
	accessTypes: WatchpointAccessType[];
	backend: WatchpointBackend;
}

/** Shared candidate, dialog, and write state for memory and register watchpoints. */
export function useWatchpointDialog(onCreated?: (watchpoint: WatchpointSnapshot) => void) {
	const [dialog, setDialog] = useState<WatchpointDialogState | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const prepare = useCallback(async (target: WatchpointTarget): Promise<boolean> => {
		setError(null);
		try {
			const candidate = await messageBus.request('getWatchpointCandidate', { target });
			if (!candidate.candidateId || !candidate.backend) {
				setError(candidate.description);
				return false;
			}
			setDialog({ target, candidateId: candidate.candidateId, description: candidate.description, accessTypes: candidate.accessTypes, backend: candidate.backend });
			return true;
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'Failed to prepare watchpoint');
			return false;
		}
	}, []);

	const confirm = useCallback(async (accessType: WatchpointAccessType): Promise<void> => {
		if (!dialog || isSubmitting) {return;}
		setIsSubmitting(true);
		setError(null);
		try {
			const result = await messageBus.request('createWatchpoint', { candidateId: dialog.candidateId, accessType });
			onCreated?.(result.watchpoint);
			setDialog(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'Failed to set watchpoint');
		} finally {
			setIsSubmitting(false);
		}
	}, [dialog, isSubmitting, onCreated]);

	const cancel = useCallback(() => {
		if (!isSubmitting) {setDialog(null);}
	}, [isSubmitting]);

	return { dialog, error, isSubmitting, prepare, confirm, cancel, setError };
}
