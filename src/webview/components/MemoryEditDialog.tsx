import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Endianness, NumberFormat } from '../../domain/config/MemoryViewConfig.js';
import {
	formatEditableMemoryValue,
	MEMORY_INPUT_FORMATS,
	parseEditableMemoryValue,
	type MemoryInputFormat,
} from '../memoryEditValue.js';
import { WriteDialogShell, writeDialogControlStyle } from './WriteDialogShell.js';

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

	return <WriteDialogShell
		title="Write memory"
		ariaLabel="Edit memory"
		meta={<><span>Address {address}</span><span>Offset 0x{offset.toString(16).toUpperCase()}</span><span>{bytes} byte{bytes === 1 ? '' : 's'}</span></>}
		preview={<>Bytes: {hex ? `0x${hex} (${parsed.data?.length} byte${parsed.data?.length === 1 ? '' : 's'})` : 'Enter valid value'}</>}
		error={parsed.error ?? error}
		isSubmitting={isSubmitting}
		confirmDisabled={!parsed.data}
		onCancel={onCancel}
		onConfirm={() => parsed.data && onConfirm(parsed.data)}
	>
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
	</WriteDialogShell>;
}

function formatLabel(format: MemoryInputFormat): string {
	return format === 'hex' ? 'Hex' : format === 'dec' ? 'Decimal' : format === 'oct' ? 'Octal' : format === 'bin' ? 'Binary' : 'ASCII';
}

function formatPlaceholder(format: MemoryInputFormat): string {
	return format === 'hex' ? '49 or 0x49' : format === 'dec' ? '73' : format === 'oct' ? '111 or 0o111' : format === 'bin' ? '1001001 or 0b1001001' : 'Hello';
}

const styles: Record<string, CSSProperties> = {
	inputRow: { display: 'flex', gap: 8 },
	format: { ...writeDialogControlStyle, flex: '0 0 92px' },
	input: { ...writeDialogControlStyle, flex: 1, minWidth: 0 },
};
