import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Endianness, NumberFormat } from '../../domain/config/MemoryViewConfig.js';
import {
	formatEditableMemoryValue,
	MEMORY_INPUT_FORMATS,
	parseEditableMemoryValue,
	type MemoryInputFormat,
} from '../memoryEditValue.js';

interface MemoryEditDialogProps {
	address: string;
	offset: number;
	initialBytes: readonly number[];
	initialFormat: NumberFormat;
	bytes: number;
	endianness: Endianness;
	error: string | null;
	isSubmitting: boolean;
	onCancel: () => void;
	onConfirm: (data: number[]) => void;
}

export function MemoryEditDialog({ address, offset, initialBytes, initialFormat, bytes, endianness, error, isSubmitting, onCancel, onConfirm }: MemoryEditDialogProps): JSX.Element {
	const [format, setFormat] = useState<MemoryInputFormat>(initialFormat);
	const [value, setValue] = useState(() => formatEditableMemoryValue(initialBytes, endianness, initialFormat));
	useEffect(() => {
		setFormat(initialFormat);
		setValue(formatEditableMemoryValue(initialBytes, endianness, initialFormat));
	}, [endianness, initialBytes, initialFormat]);
	const parsed = useMemo(() => {
		try { return { data: parseEditableMemoryValue(value, bytes, endianness, format), error: null }; }
		catch (caught) { return { data: null, error: caught instanceof Error ? caught.message : 'Invalid value' }; }
	}, [value, bytes, endianness, format]);
	const hex = parsed.data ? formatEditableMemoryValue(parsed.data, 'big', 'hex') : null;
	const handleFormatChange = (nextFormat: MemoryInputFormat): void => {
		setValue((current) => {
			try {
				const currentBytes = parseEditableMemoryValue(current, bytes, endianness, format);
				return formatEditableMemoryValue(currentBytes, endianness, nextFormat);
			} catch {
				return formatEditableMemoryValue(initialBytes, endianness, nextFormat);
			}
		});
		setFormat(nextFormat);
	};

	return (
		<div style={styles.backdrop} onMouseDown={() => !isSubmitting && onCancel()}>
			<div style={styles.dialog} role="dialog" aria-modal="true" aria-label="Edit memory" onMouseDown={(event) => event.stopPropagation()}>
				<div style={styles.title}>Write memory</div>
				<div style={styles.meta}><span>Address {address}</span><span>Offset 0x{offset.toString(16).toUpperCase()}</span><span>{bytes} byte{bytes === 1 ? '' : 's'}</span></div>
				<div style={styles.inputRow}>
					<select value={format} onChange={(event) => handleFormatChange(event.target.value as MemoryInputFormat)} style={styles.format} aria-label="Input format" disabled={isSubmitting}>
						{MEMORY_INPUT_FORMATS.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}
					</select>
					<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} style={styles.input} placeholder={formatPlaceholder(format)} aria-label={`Memory value in ${formatLabel(format)}`} disabled={isSubmitting}
					onKeyDown={(event) => {
						if (event.key === 'Escape') { event.stopPropagation(); if (!isSubmitting) onCancel(); }
						if (event.key === 'Enter' && parsed.data && !isSubmitting) { event.preventDefault(); onConfirm(parsed.data); }
					}} />
				</div>
				<div style={styles.preview}>Bytes: {hex ? `0x${hex} (${parsed.data?.length} byte${parsed.data?.length === 1 ? '' : 's'})` : 'Enter valid value'}</div>
				{(parsed.error ?? error) && <div style={styles.error}>{parsed.error ?? error}</div>}
				<div style={styles.actions}>
					<button type="button" onClick={onCancel} disabled={isSubmitting} style={styles.secondary}>Cancel</button>
					<button type="button" disabled={!parsed.data || isSubmitting} onClick={() => parsed.data && onConfirm(parsed.data)} style={styles.primary}>{isSubmitting ? 'Writing…' : 'Confirm write'}</button>
				</div>
			</div>
		</div>
	);
}

function formatLabel(format: MemoryInputFormat): string {
	return format === 'hex' ? 'Hex' : format === 'dec' ? 'Decimal' : format === 'oct' ? 'Octal' : format === 'bin' ? 'Binary' : 'ASCII';
}

function formatPlaceholder(format: MemoryInputFormat): string {
	return format === 'hex' ? '49 or 0x49' : format === 'dec' ? '73' : format === 'oct' ? '111 or 0o111' : format === 'bin' ? '1001001 or 0b1001001' : 'Hello';
}

const styles: Record<string, CSSProperties> = {
	backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
	dialog: { width: 420, maxWidth: 'calc(100vw - 32px)', padding: 16, borderRadius: 6, background: 'var(--vscode-editorWidget-background)', border: '1px solid var(--vscode-editorWidget-border)' },
	title: { fontWeight: 600, marginBottom: 10 }, meta: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12, color: 'var(--vscode-descriptionForeground)', fontSize: 12 },
	inputRow: { display: 'flex', gap: 8 }, format: { flex: '0 0 92px', color: 'var(--vscode-input-foreground)', background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border)' },
	input: { flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '7px 8px', color: 'var(--vscode-input-foreground)', background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border)' },
	preview: { marginTop: 8, color: 'var(--vscode-descriptionForeground)', fontFamily: 'var(--vscode-editor-font-family)', fontSize: 12 }, error: { marginTop: 8, color: 'var(--vscode-errorForeground)' },
	actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }, secondary: { padding: '5px 10px' }, primary: { padding: '5px 10px', color: 'var(--vscode-button-foreground)', background: 'var(--vscode-button-background)', border: 'none' },
};
