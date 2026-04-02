import { useState, useCallback, type CSSProperties, type ChangeEvent } from 'react';
import type { RegisterSetSnapshot, RegisterValueSnapshot } from '../../protocol/methods.js';

export type RegisterValueFormat = 'hex' | 'dec' | 'oct' | 'bin' | 'raw';

interface RegisterPanelProps {
	registerSets: RegisterSetSnapshot[];
	selectedSetId: string;
	registerValues: RegisterValueSnapshot[];
	isStale: boolean;
	isLoading: boolean;
	sessionStatus: 'none' | 'running' | 'stopped';
	valueFormat: RegisterValueFormat;
	onSelectSet: (setId: string) => void;
	onValueFormatChange: (format: RegisterValueFormat) => void;
	onRefresh: () => void;
	onEditSet: (set: RegisterSetSnapshot) => void;
	onCreateSet: () => void;
	onDeleteSet: (setId: string) => void;
}

export function RegisterPanel({
	registerSets,
	selectedSetId,
	registerValues,
	isStale,
	isLoading,
	sessionStatus,
	valueFormat,
	onSelectSet,
	onValueFormatChange,
	onRefresh,
	onEditSet,
	onCreateSet,
	onDeleteSet,
}: RegisterPanelProps): JSX.Element {
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const selectedSet = registerSets.find((s) => s.id === selectedSetId);
	const canEdit = Boolean(selectedSet && !selectedSet.isBuiltin);
	const canDelete = canEdit;
	const isDisabled = sessionStatus !== 'stopped';

	const handleSetChange = useCallback(
		(e: ChangeEvent<HTMLSelectElement>) => {
			onSelectSet(e.target.value);
		},
		[onSelectSet]
	);

	const handleFormatChange = useCallback(
		(e: ChangeEvent<HTMLSelectElement>) => {
			onValueFormatChange(e.target.value as RegisterValueFormat);
		},
		[onValueFormatChange]
	);

	const handleDelete = useCallback(() => {
		if (!selectedSetId) return;
		onDeleteSet(selectedSetId);
		setShowDeleteConfirm(false);
	}, [selectedSetId, onDeleteSet]);

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<div style={styles.selectors}>
					<select
						value={selectedSetId}
						onChange={handleSetChange}
						style={styles.select}
						title="Select register set"
					>
						{registerSets.map((set) => (
							<option key={set.id} value={set.id}>
								{set.name}
							</option>
						))}
					</select>
					<select
						value={valueFormat}
						onChange={handleFormatChange}
						style={styles.formatSelect}
						title="Output format"
					>
						<option value="hex">Hex</option>
						<option value="dec">Dec</option>
						<option value="oct">Oct</option>
						<option value="bin">Bin</option>
						<option value="raw">Raw</option>
					</select>
				</div>
				<div style={styles.actions}>
					<button onClick={onCreateSet} style={styles.iconButton} title="Create register set">
						<PlusIcon />
					</button>
					{canEdit && selectedSet && (
						<button
							onClick={() => onEditSet(selectedSet)}
							style={styles.iconButton}
							title="Edit register set"
						>
							<EditIcon />
						</button>
					)}
					{canDelete && (
						<button
							onClick={() => setShowDeleteConfirm(true)}
							style={styles.iconButton}
							title="Delete register set"
						>
							<TrashIcon />
						</button>
					)}
					<button
						onClick={onRefresh}
						disabled={isDisabled}
						style={styles.iconButton}
						title="Refresh registers"
					>
						<RefreshIcon />
					</button>
				</div>
			</div>

			{showDeleteConfirm && (
				<div style={styles.confirmBar}>
					<span>Delete "{selectedSet?.name}"?</span>
					<button onClick={handleDelete} style={styles.dangerButton}>Delete</button>
					<button onClick={() => setShowDeleteConfirm(false)} style={styles.cancelButton}>Cancel</button>
				</div>
			)}

			<div style={styles.tableContainer}>
				{sessionStatus !== 'stopped' ? (
					<div style={styles.message}>Pause execution to read registers.</div>
				) : registerValues.length === 0 ? (
					<div style={styles.message}>{isLoading ? 'Syncing registers...' : 'No registers in this set.'}</div>
				) : (
					<table style={styles.table}>
						<thead>
							<tr>
								<th style={styles.th}>Register</th>
								<th style={styles.th}>Value</th>
							</tr>
						</thead>
						<tbody>
							{registerValues.map((reg) => (
								<tr key={reg.expression} style={{ ...styles.tr, opacity: isStale ? 0.65 : 1 }}>
									<td style={styles.tdLabel}>{reg.expression}</td>
									<td style={styles.tdValue}>
										{reg.error ? (
											<span style={styles.error} title={reg.error}>Error</span>
										) : reg.value === null ? (
											<span style={styles.unavailable}>--</span>
										) : (
											<span style={styles.value}>{formatRegisterValue(reg.value, valueFormat)}</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}

function extractNumericToken(value: string): string | null {
	const trimmed = value.trim();
	const match = trimmed.match(/-?0x[0-9a-fA-F]+|-?0b[01]+|-?0o[0-7]+|-?\d+/);
	return match ? match[0] : null;
}

function parseToBigInt(value: string): bigint | null {
	const token = extractNumericToken(value);
	if (!token) return null;

	if (token.startsWith('-0x')) return -BigInt(`0x${token.slice(3)}`);
	if (token.startsWith('0x')) return BigInt(token);
	if (token.startsWith('-0b')) return -BigInt(`0b${token.slice(3)}`);
	if (token.startsWith('0b')) return BigInt(token);
	if (token.startsWith('-0o')) return -BigInt(`0o${token.slice(3)}`);
	if (token.startsWith('0o')) return BigInt(token);
	return BigInt(token);
}

function formatBigInt(value: bigint, format: RegisterValueFormat): string {
	if (format === 'dec') return value.toString(10);

	const negative = value < 0n;
	const abs = negative ? -value : value;
	const sign = negative ? '-' : '';

	if (format === 'hex') return `${sign}0x${abs.toString(16)}`;
	if (format === 'oct') return `${sign}0o${abs.toString(8)}`;
	if (format === 'bin') return `${sign}0b${abs.toString(2)}`;
	return value.toString(10);
}

function formatRegisterValue(value: string, format: RegisterValueFormat): string {
	if (format === 'raw') return value;
	const parsed = parseToBigInt(value);
	if (parsed === null) return value;
	return formatBigInt(parsed, format);
}

function PlusIcon(): JSX.Element {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z" />
		</svg>
	);
}

function EditIcon(): JSX.Element {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 13.59 2.41 15l4.12-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm3.83-2.06L4.47 9.76l8-8 1.77 1.77-8 8z" />
		</svg>
	);
}

function TrashIcon(): JSX.Element {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z" />
		</svg>
	);
}

function RefreshIcon(): JSX.Element {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c.335.57.528 1.222.528 1.924a4.008 4.008 0 0 1-4.006 4.006 4.008 4.008 0 0 1-4.006-4.006c0-2.206 1.794-4 4-4 .418 0 .82.064 1.2.183l-.6.6.708.707 2-2-.354-.353-.354-.354-2 2 .708.708.266-.266A4.982 4.982 0 0 0 8.25 4.5c-2.757 0-5 2.243-5 5s2.243 5 5 5 5-2.243 5-5c0-1.27-.476-2.429-1.259-3.311l.46-.58z" />
		</svg>
	);
}

const styles: Record<string, CSSProperties> = {
	container: {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		backgroundColor: 'var(--vscode-editor-background)',
	},
	header: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '6px 8px',
		borderBottom: '1px solid var(--vscode-widget-border)',
		gap: '8px',
	},
	selectors: {
		display: 'flex',
		alignItems: 'center',
		gap: '6px',
		flex: 1,
	},
	select: {
		flex: 1,
		padding: '4px 8px',
		border: '1px solid var(--vscode-input-border)',
		backgroundColor: 'var(--vscode-input-background)',
		color: 'var(--vscode-input-foreground)',
		fontSize: '13px',
		minWidth: '110px',
	},
	formatSelect: {
		padding: '4px 8px',
		border: '1px solid var(--vscode-input-border)',
		backgroundColor: 'var(--vscode-input-background)',
		color: 'var(--vscode-input-foreground)',
		fontSize: '12px',
		minWidth: '76px',
	},
	actions: {
		display: 'flex',
		gap: '2px',
	},
	iconButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '24px',
		height: '24px',
		padding: 0,
		border: 'none',
		backgroundColor: 'transparent',
		color: 'var(--vscode-foreground)',
		cursor: 'pointer',
		borderRadius: '3px',
	},
	confirmBar: {
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		padding: '6px 8px',
		backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
		borderBottom: '1px solid var(--vscode-inputValidation-warningBorder)',
		fontSize: '12px',
	},
	dangerButton: {
		padding: '2px 8px',
		border: 'none',
		backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
		color: 'var(--vscode-inputValidation-errorForeground)',
		cursor: 'pointer',
		fontSize: '12px',
		borderRadius: '2px',
	},
	cancelButton: {
		padding: '2px 8px',
		border: '1px solid var(--vscode-widget-border)',
		backgroundColor: 'transparent',
		color: 'var(--vscode-foreground)',
		cursor: 'pointer',
		fontSize: '12px',
		borderRadius: '2px',
	},
	tableContainer: {
		flex: 1,
		overflow: 'auto',
	},
	table: {
		width: '100%',
		borderCollapse: 'collapse',
		fontSize: '13px',
		fontFamily: 'var(--vscode-editor-font-family)',
	},
	th: {
		textAlign: 'left',
		padding: '4px 8px',
		borderBottom: '1px solid var(--vscode-widget-border)',
		backgroundColor: 'var(--vscode-editor-background)',
		position: 'sticky',
		top: 0,
		fontWeight: 'normal',
		color: 'var(--vscode-descriptionForeground)',
	},
	tr: {
		transition: 'opacity 0.12s',
	},
	tdLabel: {
		padding: '4px 8px',
		borderBottom: '1px solid var(--vscode-widget-border)',
		color: 'var(--vscode-symbolIcon-variableForeground)',
		fontFamily: 'var(--vscode-editor-font-family)',
	},
	tdValue: {
		padding: '4px 8px',
		borderBottom: '1px solid var(--vscode-widget-border)',
		fontFamily: 'var(--vscode-editor-font-family)',
	},
	value: {
		color: 'var(--vscode-debugTokenExpression-number)',
	},
	error: {
		color: 'var(--vscode-errorForeground)',
		fontStyle: 'italic',
	},
	unavailable: {
		color: 'var(--vscode-descriptionForeground)',
	},
	message: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: '100%',
		color: 'var(--vscode-descriptionForeground)',
		fontSize: '13px',
		padding: '16px',
	},
};
