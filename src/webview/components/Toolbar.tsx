import { useState, useEffect, useCallback, type FormEvent, type KeyboardEvent, type CSSProperties } from 'react';
import type { PresetSnapshot } from '../../protocol/methods.js';

interface ToolbarProps {
	sessionStatus: 'none' | 'running' | 'stopped';
	presets: PresetSnapshot[];
	selectedPresetId: string | null;
	onOpenDocument: (target: string) => void;
	onSelectPreset: (preset: PresetSnapshot | null) => void;
	onSavePreset: (name: string, target: string) => void;
	onDeletePreset: (id: string) => void;
	onRefresh: () => void;
	onToggleSettings: () => void;
	isLoading: boolean;
	showSettings: boolean;
	currentTarget: string;
}

/**
 * Toolbar for memory view with address input, preset combobox, and quick register buttons.
 */
export function Toolbar({
	sessionStatus,
	presets,
	selectedPresetId,
	onOpenDocument,
	onSelectPreset,
	onSavePreset,
	onDeletePreset,
	onRefresh,
	onToggleSettings,
	isLoading,
	showSettings,
	currentTarget,
}: ToolbarProps): JSX.Element {
	const [target, setTarget] = useState('');
	const [showSaveDialog, setShowSaveDialog] = useState(false);
	const [presetName, setPresetName] = useState('');

	useEffect(() => {
		setTarget(currentTarget);
	}, [currentTarget]);

	const isDisabled = sessionStatus !== 'stopped' || isLoading;
	const canRefresh = sessionStatus === 'stopped' && !isLoading;

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			const trimmed = target.trim();
			if (trimmed && !isDisabled) {
				onOpenDocument(trimmed);
			}
		},
		[target, isDisabled, onOpenDocument]
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') {
				const trimmed = target.trim();
				if (trimmed && !isDisabled) {
					onOpenDocument(trimmed);
				}
			}
		},
		[target, isDisabled, onOpenDocument]
	);

	const handleQuickButton = useCallback(
		(register: string) => {
			if (!isDisabled) {
				setTarget(register);
				onOpenDocument(register);
			}
		},
		[isDisabled, onOpenDocument]
	);

	const handlePresetChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const value = e.target.value;
			if (value === '') {
				onSelectPreset(null);
			} else {
				const preset = presets.find((p) => p.id === value);
				if (preset) {
					setTarget(preset.target);
					onSelectPreset(preset);
				}
			}
		},
		[presets, onSelectPreset]
	);

	const handleSavePreset = useCallback(() => {
		const name = presetName.trim();
		if (name && currentTarget) {
			onSavePreset(name, currentTarget);
			setShowSaveDialog(false);
			setPresetName('');
		}
	}, [presetName, currentTarget, onSavePreset]);

	const handleDeleteSelectedPreset = useCallback(() => {
		const selected = presets.find((p) => p.id === selectedPresetId);
		if (selected && !selected.isBuiltin) {
			onDeletePreset(selected.id);
		}
	}, [presets, selectedPresetId, onDeletePreset]);

	const selectedPreset = presets.find((p) => p.id === selectedPresetId);
	const canDelete = selectedPreset && !selectedPreset.isBuiltin;

	return (
		<div style={styles.container}>
			{/* Preset selector */}
			<div style={styles.presetSection}>
				<select
					value={selectedPresetId || ''}
					onChange={handlePresetChange}
					style={styles.presetSelect}
					disabled={isDisabled}
					title="Select preset"
				>
					<option value="">Custom...</option>
					{presets.map((preset) => (
						<option key={preset.id} value={preset.id}>
							{preset.name}
						</option>
					))}
				</select>
				{canDelete && (
					<button
						onClick={handleDeleteSelectedPreset}
						style={styles.smallIconButton}
						title="Delete preset"
						disabled={isDisabled}
					>
						<TrashIcon />
					</button>
				)}
			</div>

			{/* Address input */}
			<form onSubmit={handleSubmit} style={styles.form}>
				<input
					type="text"
					value={target}
					onChange={(e) => setTarget(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Address, register ($pc), or expression"
					disabled={isDisabled}
					style={styles.input}
					aria-label="Memory address or expression"
				/>
				<button
					type="submit"
					disabled={isDisabled || !target.trim()}
					style={styles.button}
					title="Open memory at address"
				>
					Go
				</button>
			</form>

			{/* Quick register buttons */}
			<div style={styles.quickButtons}>
				<QuickButton
					label="PC"
					title="Program Counter"
					onClick={() => handleQuickButton('$pc')}
					disabled={isDisabled}
				/>
				<QuickButton
					label="SP"
					title="Stack Pointer"
					onClick={() => handleQuickButton('$sp')}
					disabled={isDisabled}
				/>
				<QuickButton
					label="LR"
					title="Link Register"
					onClick={() => handleQuickButton('$lr')}
					disabled={isDisabled}
				/>
			</div>

			{/* Actions */}
			<div style={styles.actions}>
				<button
					onClick={() => setShowSaveDialog(true)}
					disabled={!currentTarget || isDisabled}
					style={styles.smallIconButton}
					title="Save as preset"
				>
					<SaveIcon />
				</button>
				<button
					onClick={onToggleSettings}
					style={{
						...styles.smallIconButton,
						backgroundColor: showSettings ? 'var(--vscode-toolbar-activeBackground)' : 'transparent',
					}}
					title="View settings"
				>
					<SettingsIcon />
				</button>
				<button
					onClick={onRefresh}
					disabled={!canRefresh}
					style={styles.smallIconButton}
					title="Refresh memory"
					aria-label="Refresh memory"
				>
					<RefreshIcon />
				</button>
			</div>

			{/* Save preset dialog */}
			{showSaveDialog && (
				<div style={styles.saveDialog}>
					<div style={styles.saveDialogContent}>
						<input
							type="text"
							value={presetName}
							onChange={(e) => setPresetName(e.target.value)}
							placeholder="Preset name"
							style={styles.input}
							autoFocus
							onKeyDown={(e) => {
								if (e.key === 'Enter') handleSavePreset();
								if (e.key === 'Escape') setShowSaveDialog(false);
							}}
						/>
						<button onClick={handleSavePreset} style={styles.button} disabled={!presetName.trim()}>
							Save
						</button>
						<button onClick={() => setShowSaveDialog(false)} style={styles.cancelButton}>
							Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

interface QuickButtonProps {
	label: string;
	title: string;
	onClick: () => void;
	disabled: boolean;
}

function QuickButton({ label, title, onClick, disabled }: QuickButtonProps): JSX.Element {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			style={styles.quickButton}
			title={title}
		>
			{label}
		</button>
	);
}

function RefreshIcon(): JSX.Element {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c.335.57.528 1.222.528 1.924a4.008 4.008 0 0 1-4.006 4.006 4.008 4.008 0 0 1-4.006-4.006c0-2.206 1.794-4 4-4 .418 0 .82.064 1.2.183l-.6.6.708.707 2-2-.354-.353-.354-.354-2 2 .708.708.266-.266A4.982 4.982 0 0 0 8.25 4.5c-2.757 0-5 2.243-5 5s2.243 5 5 5 5-2.243 5-5c0-1.27-.476-2.429-1.259-3.311l.46-.58z" />
		</svg>
	);
}

function SettingsIcon(): JSX.Element {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.8-1.3 2 .8.8 2-1.3.8.3.4 2.3h1.2l.5-2.4.8-.3 2 1.3.8-.8-1.3-2 .3-.8 2.3-.4V7.4l-2.4-.5-.3-.8 1.3-2-.8-.8-2 1.3-.7-.2zM9.4 1l.5 2.4L12 2.1l2 2-1.4 2.1 2.4.4v2.8l-2.4.5L14 12l-2 2-2.1-1.4-.5 2.4H6.6l-.5-2.4L4 13.9l-2-2 1.4-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2 2.1 1.4.4-2.4h2.8zm.6 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm1 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0z" />
		</svg>
	);
}

function SaveIcon(): JSX.Element {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M13.354 1.146l1.5 1.5A.5.5 0 0 1 15 3v11.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-13A.5.5 0 0 1 1.5 1h10.5a.5.5 0 0 1 .354.146zM14 3.207L12.793 2H11v3H4V2H2v12h1v-4.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 .5.5V14h1V3.207zM12 14v-4H4v4h8zm-2-9V2H5v3h5z" />
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

const styles: Record<string, CSSProperties> = {
	container: {
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		padding: '6px 8px',
		borderBottom: '1px solid var(--vscode-widget-border)',
		backgroundColor: 'var(--vscode-editor-background)',
		flexWrap: 'wrap',
		position: 'relative',
	},
	presetSection: {
		display: 'flex',
		alignItems: 'center',
		gap: '2px',
	},
	presetSelect: {
		padding: '4px 8px',
		border: '1px solid var(--vscode-input-border)',
		backgroundColor: 'var(--vscode-input-background)',
		color: 'var(--vscode-input-foreground)',
		fontSize: '13px',
		minWidth: '100px',
	},
	form: {
		display: 'flex',
		flex: 1,
		gap: '4px',
		minWidth: '200px',
	},
	input: {
		flex: 1,
		padding: '4px 8px',
		border: '1px solid var(--vscode-input-border)',
		backgroundColor: 'var(--vscode-input-background)',
		color: 'var(--vscode-input-foreground)',
		fontSize: '13px',
		fontFamily: 'var(--vscode-editor-font-family)',
		outline: 'none',
	},
	button: {
		padding: '4px 12px',
		border: '1px solid var(--vscode-button-border, transparent)',
		backgroundColor: 'var(--vscode-button-background)',
		color: 'var(--vscode-button-foreground)',
		cursor: 'pointer',
		fontSize: '13px',
	},
	cancelButton: {
		padding: '4px 12px',
		border: '1px solid var(--vscode-button-secondaryBorder, var(--vscode-widget-border))',
		backgroundColor: 'var(--vscode-button-secondaryBackground)',
		color: 'var(--vscode-button-secondaryForeground)',
		cursor: 'pointer',
		fontSize: '13px',
	},
	quickButtons: {
		display: 'flex',
		gap: '4px',
	},
	quickButton: {
		padding: '4px 8px',
		border: '1px solid var(--vscode-button-secondaryBorder, var(--vscode-widget-border))',
		backgroundColor: 'var(--vscode-button-secondaryBackground)',
		color: 'var(--vscode-button-secondaryForeground)',
		cursor: 'pointer',
		fontSize: '12px',
		fontFamily: 'var(--vscode-editor-font-family)',
	},
	actions: {
		display: 'flex',
		gap: '4px',
	},
	smallIconButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '26px',
		height: '26px',
		padding: 0,
		border: 'none',
		backgroundColor: 'transparent',
		color: 'var(--vscode-foreground)',
		cursor: 'pointer',
		borderRadius: '3px',
	},
	saveDialog: {
		position: 'absolute',
		top: '100%',
		right: '8px',
		zIndex: 100,
		backgroundColor: 'var(--vscode-dropdown-background)',
		border: '1px solid var(--vscode-dropdown-border)',
		borderRadius: '4px',
		padding: '8px',
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
	},
	saveDialogContent: {
		display: 'flex',
		gap: '4px',
		alignItems: 'center',
	},
};
