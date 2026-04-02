import { useState, useCallback, type CSSProperties } from 'react';
import type { MemoryViewConfig, UnitSize, Endianness, NumberFormat, DecodedMode } from '../../domain/config/MemoryViewConfig.js';
import {
	VALID_COLUMNS,
	VALID_UNIT_SIZES,
	VALID_NUMBER_FORMATS,
	VALID_DECODED_MODES,
	MIN_TOTAL_SIZE,
	MAX_TOTAL_SIZE,
	formatByteSize,
	parseByteSize,
	validateConfig,
} from '../../domain/config/MemoryViewConfig.js';

interface SettingsPanelProps {
	config: MemoryViewConfig;
	currentTarget: string;
	onApply: (config: MemoryViewConfig, target: string) => void;
	onCancel: () => void;
	disabled?: boolean;
}

/**
 * Settings panel for memory view configuration.
 * Has draft state with Apply/Cancel buttons.
 */
export function SettingsPanel({
	config,
	currentTarget,
	onApply,
	onCancel,
	disabled = false,
}: SettingsPanelProps): JSX.Element {
	// Draft state
	const [target, setTarget] = useState(currentTarget);
	const [columns, setColumns] = useState(config.columns);
	const [unitSize, setUnitSize] = useState<UnitSize>(config.unitSize);
	const [endianness, setEndianness] = useState<Endianness>(config.endianness);
	const [totalSizeInput, setTotalSizeInput] = useState(formatByteSize(config.totalSize));
	const [numberFormat, setNumberFormat] = useState<NumberFormat>(config.numberFormat);
	const [decodedMode, setDecodedMode] = useState<DecodedMode>(config.decodedMode);
	const [errors, setErrors] = useState<string[]>([]);

	const handleApply = useCallback(() => {
		// Parse total size
		const parsedSize = parseByteSize(totalSizeInput);
		if (parsedSize === null) {
			setErrors(['Invalid size format. Use: 256, 1KB, 4MB, etc.']);
			return;
		}

		const newConfig: MemoryViewConfig = {
			columns,
			unitSize,
			endianness,
			totalSize: Math.min(Math.max(parsedSize, MIN_TOTAL_SIZE), MAX_TOTAL_SIZE),
			numberFormat,
			decodedMode,
		};

		const configErrors = validateConfig(newConfig);
		if (configErrors.length > 0) {
			setErrors(configErrors);
			return;
		}

		if (!target.trim()) {
			setErrors(['Target address cannot be empty']);
			return;
		}

		setErrors([]);
		onApply(newConfig, target.trim());
	}, [columns, unitSize, endianness, totalSizeInput, numberFormat, decodedMode, target, onApply]);

	const hasChanges =
		target !== currentTarget ||
		columns !== config.columns ||
		unitSize !== config.unitSize ||
		endianness !== config.endianness ||
		numberFormat !== config.numberFormat ||
		decodedMode !== config.decodedMode ||
		parseByteSize(totalSizeInput) !== config.totalSize;

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<span style={styles.title}>View Settings</span>
			</div>

			<div style={styles.form}>
				{/* Target Address */}
				<div style={styles.field}>
					<label style={styles.label}>Address / Expression</label>
					<input
						type="text"
						value={target}
						onChange={(e) => setTarget(e.target.value)}
						placeholder="0x20000000, $sp, &myVar"
						style={styles.input}
						disabled={disabled}
					/>
				</div>

				{/* Size */}
				<div style={styles.field}>
					<label style={styles.label}>Total Size</label>
					<input
						type="text"
						value={totalSizeInput}
						onChange={(e) => setTotalSizeInput(e.target.value)}
						placeholder="4 MB"
						style={styles.input}
						disabled={disabled}
					/>
					<span style={styles.hint}>e.g., 256, 1KB, 4MB</span>
				</div>

				{/* Two-column layout for smaller fields */}
				<div style={styles.row}>
					{/* Columns */}
					<div style={styles.halfField}>
						<label style={styles.label}>Columns</label>
						<select
							value={columns}
							onChange={(e) => setColumns(Number(e.target.value))}
							style={styles.select}
							disabled={disabled}
						>
							{VALID_COLUMNS.map((c) => (
								<option key={c} value={c}>
									{c}
								</option>
							))}
						</select>
					</div>

					{/* Unit Size */}
					<div style={styles.halfField}>
						<label style={styles.label}>Unit Size</label>
						<select
							value={unitSize}
							onChange={(e) => setUnitSize(Number(e.target.value) as UnitSize)}
							style={styles.select}
							disabled={disabled}
						>
							{VALID_UNIT_SIZES.map((s) => (
								<option key={s} value={s}>
									{s}B ({unitSizeLabel(s)})
								</option>
							))}
						</select>
					</div>
				</div>

				<div style={styles.row}>
					{/* Endianness */}
					<div style={styles.halfField}>
						<label style={styles.label}>Byte Order</label>
						<select
							value={endianness}
							onChange={(e) => setEndianness(e.target.value as Endianness)}
							style={styles.select}
							disabled={disabled}
						>
							<option value="little">Little</option>
							<option value="big">Big</option>
						</select>
					</div>

					{/* Number Format */}
					<div style={styles.halfField}>
						<label style={styles.label}>Number Format</label>
						<select
							value={numberFormat}
							onChange={(e) => setNumberFormat(e.target.value as NumberFormat)}
							style={styles.select}
							disabled={disabled}
						>
							{VALID_NUMBER_FORMATS.map((f) => (
								<option key={f} value={f}>
									{formatLabel(f)}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Decoded Mode */}
				<div style={styles.field}>
					<label style={styles.label}>Decoded Column</label>
					<select
						value={decodedMode}
						onChange={(e) => setDecodedMode(e.target.value as DecodedMode)}
						style={styles.select}
						disabled={disabled || unitSize !== 1}
					>
						{VALID_DECODED_MODES.map((m) => (
							<option key={m} value={m}>
								{decodedModeLabel(m)}
							</option>
						))}
					</select>
					{unitSize !== 1 && (
						<span style={styles.hint}>Only available with 1-byte unit size</span>
					)}
				</div>

				{/* Errors */}
				{errors.length > 0 && (
					<div style={styles.errors}>
						{errors.map((err, i) => (
							<div key={i} style={styles.error}>
								{err}
							</div>
						))}
					</div>
				)}

				{/* Actions */}
				<div style={styles.actions}>
					<button
						onClick={onCancel}
						style={styles.cancelButton}
						disabled={disabled}
					>
						Cancel
					</button>
					<button
						onClick={handleApply}
						style={styles.applyButton}
						disabled={disabled || !hasChanges}
					>
						Apply
					</button>
				</div>
			</div>
		</div>
	);
}

function unitSizeLabel(size: UnitSize): string {
	switch (size) {
		case 1:
			return 'Byte';
		case 2:
			return 'Word';
		case 4:
			return 'DWord';
		case 8:
			return 'QWord';
		case 16:
			return 'OWord';
		default:
			return `${size}B`;
	}
}

function formatLabel(format: NumberFormat): string {
	switch (format) {
		case 'hex':
			return 'Hexadecimal';
		case 'dec':
			return 'Decimal';
		case 'oct':
			return 'Octal';
		case 'bin':
			return 'Binary';
		default:
			return format;
	}
}

function decodedModeLabel(mode: DecodedMode): string {
	switch (mode) {
		case 'ascii':
			return 'ASCII';
		case 'uint8':
			return 'Unsigned (0-255)';
		case 'int8':
			return 'Signed (-128..127)';
		case 'bin':
			return 'Binary';
		case 'hidden':
			return 'Hidden';
		default:
			return mode;
	}
}

const styles: Record<string, CSSProperties> = {
	container: {
		backgroundColor: 'var(--vscode-sideBar-background)',
		borderBottom: '1px solid var(--vscode-widget-border)',
		padding: '8px 12px',
	},
	header: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: '12px',
	},
	title: {
		fontSize: '13px',
		fontWeight: 500,
		color: 'var(--vscode-foreground)',
	},
	form: {
		display: 'flex',
		flexDirection: 'column',
		gap: '10px',
	},
	row: {
		display: 'flex',
		gap: '12px',
	},
	field: {
		display: 'flex',
		flexDirection: 'column',
		gap: '4px',
	},
	halfField: {
		display: 'flex',
		flexDirection: 'column',
		gap: '4px',
		flex: 1,
	},
	label: {
		fontSize: '12px',
		color: 'var(--vscode-descriptionForeground)',
	},
	input: {
		padding: '4px 8px',
		border: '1px solid var(--vscode-input-border)',
		backgroundColor: 'var(--vscode-input-background)',
		color: 'var(--vscode-input-foreground)',
		fontSize: '13px',
		fontFamily: 'var(--vscode-editor-font-family)',
	},
	select: {
		padding: '4px 8px',
		border: '1px solid var(--vscode-input-border)',
		backgroundColor: 'var(--vscode-input-background)',
		color: 'var(--vscode-input-foreground)',
		fontSize: '13px',
	},
	hint: {
		fontSize: '11px',
		color: 'var(--vscode-descriptionForeground)',
		opacity: 0.8,
	},
	errors: {
		display: 'flex',
		flexDirection: 'column',
		gap: '4px',
	},
	error: {
		fontSize: '12px',
		color: 'var(--vscode-errorForeground)',
	},
	actions: {
		display: 'flex',
		justifyContent: 'flex-end',
		gap: '8px',
		marginTop: '8px',
	},
	cancelButton: {
		padding: '4px 12px',
		border: '1px solid var(--vscode-button-secondaryBorder, var(--vscode-widget-border))',
		backgroundColor: 'var(--vscode-button-secondaryBackground)',
		color: 'var(--vscode-button-secondaryForeground)',
		cursor: 'pointer',
		fontSize: '13px',
	},
	applyButton: {
		padding: '4px 12px',
		border: '1px solid var(--vscode-button-border, transparent)',
		backgroundColor: 'var(--vscode-button-background)',
		color: 'var(--vscode-button-foreground)',
		cursor: 'pointer',
		fontSize: '13px',
	},
};
