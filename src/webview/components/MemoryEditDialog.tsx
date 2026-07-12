import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Endianness } from '../../domain/config/MemoryViewConfig.js';
import { parseEditableMemoryValue } from '../memoryEditValue.js';

interface MemoryEditDialogProps {
	address: string;
	offset: number;
	initialValue: string;
	bytes: number;
	endianness: Endianness;
	error: string | null;
	isSubmitting: boolean;
	onCancel: () => void;
	onConfirm: (data: number[]) => void;
}

export function MemoryEditDialog({ address, offset, initialValue, bytes, endianness, error, isSubmitting, onCancel, onConfirm }: MemoryEditDialogProps): JSX.Element {
	const [value, setValue] = useState(initialValue);
	useEffect(() => setValue(initialValue), [initialValue]);
	const parsed = useMemo(() => {
		try { return { data: parseEditableMemoryValue(value, bytes, endianness), error: null }; }
		catch (caught) { return { data: null, error: caught instanceof Error ? caught.message : 'Invalid value' }; }
	}, [value, bytes, endianness]);
	const hex = parsed.data?.map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();

	return (
		<div style={styles.backdrop} onMouseDown={() => !isSubmitting && onCancel()}>
			<div style={styles.dialog} role="dialog" aria-modal="true" aria-label="Edit memory" onMouseDown={(event) => event.stopPropagation()}>
				<div style={styles.title}>Write memory</div>
				<div style={styles.meta}><span>Address {address}</span><span>Offset 0x{offset.toString(16).toUpperCase()}</span><span>{bytes} byte{bytes === 1 ? '' : 's'}</span></div>
				<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} style={styles.input} placeholder="49 or 0x49" aria-label="Memory value in hexadecimal" disabled={isSubmitting}
					onKeyDown={(event) => {
						if (event.key === 'Escape') { event.stopPropagation(); if (!isSubmitting) onCancel(); }
						if (event.key === 'Enter' && parsed.data && !isSubmitting) { event.preventDefault(); onConfirm(parsed.data); }
					}} />
				<div style={styles.preview}>Preview: {hex ? `0x${hex}` : value.trim() || 'Enter hex value'}</div>
				{(parsed.error ?? error) && <div style={styles.error}>{parsed.error ?? error}</div>}
				<div style={styles.actions}>
					<button type="button" onClick={onCancel} disabled={isSubmitting} style={styles.secondary}>Cancel</button>
					<button type="button" disabled={!parsed.data || isSubmitting} onClick={() => parsed.data && onConfirm(parsed.data)} style={styles.primary}>{isSubmitting ? 'Writing…' : 'Confirm write'}</button>
				</div>
			</div>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
	dialog: { width: 420, maxWidth: 'calc(100vw - 32px)', padding: 16, borderRadius: 6, background: 'var(--vscode-editorWidget-background)', border: '1px solid var(--vscode-editorWidget-border)' },
	title: { fontWeight: 600, marginBottom: 10 }, meta: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12, color: 'var(--vscode-descriptionForeground)', fontSize: 12 },
	input: { width: '100%', boxSizing: 'border-box', padding: '7px 8px', color: 'var(--vscode-input-foreground)', background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border)' },
	preview: { marginTop: 8, color: 'var(--vscode-descriptionForeground)', fontFamily: 'var(--vscode-editor-font-family)', fontSize: 12 }, error: { marginTop: 8, color: 'var(--vscode-errorForeground)' },
	actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }, secondary: { padding: '5px 10px' }, primary: { padding: '5px 10px', color: 'var(--vscode-button-foreground)', background: 'var(--vscode-button-background)', border: 'none' },
};
