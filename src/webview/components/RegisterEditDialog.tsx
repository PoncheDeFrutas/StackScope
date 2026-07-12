import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Endianness } from '../../domain/config/MemoryViewConfig.js';
import {
	formatEditableMemoryValue,
	formatRegisterInputValue,
	inferRegisterByteLength,
	MEMORY_INPUT_FORMATS,
	parseRegisterInputValue,
	REGISTER_BYTE_LENGTHS,
	resolveRegisterInputFormat,
	type RegisterByteLength,
	type RegisterInputFormat,
} from '../memoryEditValue.js';
import { WriteDialogShell, writeDialogControlStyle } from './WriteDialogShell.js';

interface RegisterEditDialogProps {
	expression: string;
	initialValue: string;
	initialFormat: RegisterInputFormat;
	endianness: Endianness;
	error: string | null;
	isSubmitting: boolean;
	onCancel: () => void;
	onConfirm: (value: string) => void;
}

export function RegisterEditDialog({ expression, initialValue, initialFormat, endianness, error, isSubmitting, onCancel, onConfirm }: RegisterEditDialogProps): JSX.Element {
	const initialByteLength = inferRegisterByteLength(initialValue);
	const resolvedFormat = resolveRegisterInputFormat(initialValue, initialFormat);
	const [byteLength, setByteLength] = useState<RegisterByteLength>(initialByteLength);
	const [format, setFormat] = useState<RegisterInputFormat>(resolvedFormat);
	const [value, setValue] = useState(() => formatRegisterInputValue(initialValue, initialByteLength, endianness, resolvedFormat));

	useEffect(() => {
		const nextByteLength = inferRegisterByteLength(initialValue);
		const nextFormat = resolveRegisterInputFormat(initialValue, initialFormat);
		setByteLength(nextByteLength);
		setFormat(nextFormat);
		setValue(formatRegisterInputValue(initialValue, nextByteLength, endianness, nextFormat));
	}, [endianness, initialFormat, initialValue]);

	const parsed = useMemo(() => {
		try {
			return { result: parseRegisterInputValue(value, byteLength, endianness, format), error: null };
		} catch (caught) {
			return { result: null, error: caught instanceof Error ? caught.message : 'Invalid register value' };
		}
	}, [byteLength, endianness, format, value]);

	const changeFormat = (nextFormat: RegisterInputFormat): void => {
		setFormat(nextFormat);
		setValue(formatRegisterInputValue(initialValue, byteLength, endianness, nextFormat));
	};
	const changeByteLength = (nextByteLength: RegisterByteLength): void => {
		setByteLength(nextByteLength);
		setValue(formatRegisterInputValue(initialValue, nextByteLength, endianness, format));
	};
	const preview = parsed.result?.bytes
		? `0x${formatEditableMemoryValue(parsed.result.bytes, endianness, 'hex')}`
		: 'Adapter receives value unchanged';

	return <WriteDialogShell
		title={`Write ${expression}`}
		ariaLabel={`Edit ${expression}`}
		preview={format === 'raw' ? preview : `Bytes: ${preview} · ${endianness}-endian`}
		error={parsed.error ?? error}
		isSubmitting={isSubmitting}
		confirmDisabled={!parsed.result}
		onCancel={onCancel}
		onConfirm={() => parsed.result && onConfirm(parsed.result.expression)}
	>
		<div style={styles.controls}>
			<select value={format} onChange={(event) => changeFormat(event.target.value as RegisterInputFormat)} style={styles.select} aria-label="Register input format" disabled={isSubmitting}>
				{MEMORY_INPUT_FORMATS.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}
				<option value="raw">Raw</option>
			</select>
			{format !== 'raw' && <select value={byteLength} onChange={(event) => changeByteLength(Number(event.target.value) as RegisterByteLength)} style={styles.widthSelect} aria-label="Register size" disabled={isSubmitting}>
				{REGISTER_BYTE_LENGTHS.map((length) => <option key={length} value={length}>{length * 8}-bit</option>)}
			</select>}
		</div>
		<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} style={styles.input} disabled={isSubmitting} placeholder={formatPlaceholder(format)} aria-label={`New ${formatLabel(format)} value for ${expression}`} onKeyDown={(event) => {
			if (event.key === 'Escape' && !isSubmitting) onCancel();
			if (event.key === 'Enter' && parsed.result && !isSubmitting) { event.preventDefault(); onConfirm(parsed.result.expression); }
		}} />
	</WriteDialogShell>;
}

function formatLabel(format: RegisterInputFormat): string {
	return format === 'hex' ? 'Hex' : format === 'dec' ? 'Decimal' : format === 'oct' ? 'Octal' : format === 'bin' ? 'Binary' : format === 'ascii' ? 'ASCII' : 'Raw';
}

function formatPlaceholder(format: RegisterInputFormat): string {
	return format === 'hex' ? '49 or 0x49' : format === 'dec' ? '73' : format === 'oct' ? '111 or 0o111' : format === 'bin' ? '1001001 or 0b1001001' : format === 'ascii' ? 'Hello' : 'Debugger expression';
}

const styles: Record<string, CSSProperties> = {
	controls: { display: 'flex', gap: 8, marginBottom: 8 },
	select: { ...writeDialogControlStyle, flex: 1, minWidth: 0 },
	widthSelect: { ...writeDialogControlStyle, flex: '0 0 92px' },
	input: { ...writeDialogControlStyle, width: '100%' },
};
