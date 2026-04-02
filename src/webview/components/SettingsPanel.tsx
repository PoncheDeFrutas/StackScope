import { useState, useCallback, type CSSProperties } from 'react';
import type { MemoryViewConfig, UnitSize, Endianness } from '../../domain/config/MemoryViewConfig.js';
import {
	VALID_COLUMNS,
	VALID_UNIT_SIZES,
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
	}, [columns, unitSize, endianness, totalSizeInput, target, onApply]);

	const hasChanges =
		target !== currentTarget ||
		columns !== config.columns ||
		unitSize !== config.unitSize ||
		endianness !== config.endianness ||
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

				{/* Columns */}
				<div style={styles.field}>
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
				<div style={styles.field}>
					<label style={styles.label}>Unit Size</label>
					<select
						value={unitSize}
						onChange={(e) => setUnitSize(Number(e.target.value) as UnitSize)}
						style={styles.select}
						disabled={disabled}
					>
						{VALID_UNIT_SIZES.map((s) => (
							<option key={s} value={s}>
								{s} byte{s > 1 ? 's' : ''} ({unitSizeLabel(s)})
							</option>
						))}
					</select>
				</div>

				{/* Endianness */}
				<div style={styles.field}>
					<label style={styles.label}>Byte Order</label>
					<select
						value={endianness}
						onChange={(e) => setEndianness(e.target.value as Endianness)}
						style={styles.select}
						disabled={disabled}
					>
						<option value="little">Little Endian</option>
						<option value="big">Big Endian</option>
					</select>
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
	field: {
		display: 'flex',
		flexDirection: 'column',
		gap: '4px',
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
