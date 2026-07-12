import { useCallback, useEffect, useState } from 'react';
import type { DocumentSnapshot, SessionSnapshot } from '../../protocol/methods.js';
import type { Endianness } from '../../domain/config/MemoryViewConfig.js';
import type { ByteChangeMap } from '../changeTracking.js';
import type { UsePagedMemoryResult } from './usePagedMemory.js';
import { HostClient } from '../rpc/HostClient.js';
import { formatEditableMemoryValue } from '../memoryEditValue.js';

interface MemoryEdit {
	offset: number;
	oldBytes: number[];
}

interface UndoEntry {
	documentId: string;
	offset: number;
	data: number[];
}

interface UseMemoryEditingOptions {
	document: DocumentSnapshot | null;
	session: SessionSnapshot | null;
	endianness: Endianness;
	pagedMemory: UsePagedMemoryResult;
	setChangedBytes: React.Dispatch<React.SetStateAction<ByteChangeMap>>;
}

export function useMemoryEditing({ document, session, endianness, pagedMemory, setChangedBytes }: UseMemoryEditingOptions) {
	const [edit, setEdit] = useState<MemoryEdit | null>(null);
	const [editError, setEditError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
	const [isMutating, setIsMutating] = useState(false);

	useEffect(() => {
		setEdit(null);
		setEditError(null);
		setActionError(null);
		setUndoStack([]);
	}, [document?.id]);

	useEffect(() => {
		if (session?.status !== 'stopped') {
			setEdit(null);
			setUndoStack([]);
		}
	}, [session?.status]);

	const beginEdit = useCallback((offset: number, oldBytes: number[]) => {
		if (!document || session?.status !== 'stopped' || isMutating) {
			return;
		}
		setEdit({ offset, oldBytes });
		setEditError(null);
		setActionError(null);
	}, [document, session?.status, isMutating]);

	const submitEdit = useCallback(async (data: number[]) => {
		if (!edit || !document || session?.status !== 'stopped' || isMutating) {
			return;
		}
		setIsMutating(true);
		setEditError(null);
		try {
			const result = await HostClient.writeMemory(document.id, edit.offset, data);
			pagedMemory.applyVerifiedBytes(result.offset, result.verification.data);
			if (!result.verified) {
				setEditError('Write verification failed. Memory was re-read but does not match the requested value.');
				return;
			}
			if (result.bytesWritten > 0) {
				setChangedBytes((previous) => {
					const next = new Map(previous);
					for (let index = 0; index < result.bytesWritten; index++) {
						next.set(result.offset + index, Date.now());
					}
					return next;
				});
				setUndoStack((previous) => [...previous.slice(-19), {
					documentId: document.id,
					offset: result.offset,
					data: edit.oldBytes.slice(0, result.bytesWritten),
				}]);
			}
			setEdit(null);
			setActionError(result.partial ? `Partial write: ${result.bytesWritten}/${data.length} bytes written. You can undo the verified bytes.` : null);
		} catch (error) {
			setEditError(error instanceof Error ? error.message : 'Write failed');
		} finally {
			setIsMutating(false);
		}
	}, [document, edit, isMutating, pagedMemory, session?.status, setChangedBytes]);

	const undo = useCallback(async () => {
		const entry = undoStack.at(-1);
		if (!entry || !document || entry.documentId !== document.id || session?.status !== 'stopped' || isMutating) {
			return;
		}
		setIsMutating(true);
		try {
			const result = await HostClient.writeMemory(entry.documentId, entry.offset, entry.data);
			pagedMemory.applyVerifiedBytes(result.offset, result.verification.data);
			if (!result.verified) {
				setActionError('Undo could not be verified.');
				return;
			}
			setUndoStack((previous) => {
				const next = previous.slice(0, -1);
				if (result.bytesWritten < entry.data.length) {
					next.push({ documentId: entry.documentId, offset: entry.offset + result.bytesWritten, data: entry.data.slice(result.bytesWritten) });
				}
				return next;
			});
			setActionError(result.partial ? `Undo partially restored ${result.bytesWritten}/${entry.data.length} bytes.` : null);
		} catch (error) {
			setActionError(error instanceof Error ? error.message : 'Undo failed');
		} finally {
			setIsMutating(false);
		}
	}, [document, isMutating, pagedMemory, session?.status, undoStack]);

	const canUndo = Boolean(document && session?.status === 'stopped' && !isMutating && undoStack.at(-1)?.documentId === document.id);
	return {
		edit,
		editError,
		actionError,
		isMutating,
		canUndo,
		beginEdit,
		submitEdit,
		cancelEdit: () => !isMutating && setEdit(null),
		undo,
		initialEditValue: edit ? formatEditableMemoryValue(edit.oldBytes, endianness) : '',
	};
}
