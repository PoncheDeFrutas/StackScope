import { useState, useCallback, type FormEvent, type KeyboardEvent } from 'react';

interface ToolbarProps {
	sessionStatus: 'none' | 'running' | 'stopped';
	onOpenDocument: (target: string) => void;
	onRefresh: () => void;
	isLoading: boolean;
}

/**
 * Toolbar for memory view with address input and quick register buttons.
 */
export function Toolbar({
	sessionStatus,
	onOpenDocument,
	onRefresh,
	isLoading,
}: ToolbarProps): JSX.Element {
	const [target, setTarget] = useState('');

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

	return (
		<div style={styles.container}>
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

			<div style={styles.actions}>
				<button
					onClick={onRefresh}
					disabled={!canRefresh}
					style={styles.iconButton}
					title="Refresh memory"
					aria-label="Refresh memory"
				>
					<RefreshIcon />
				</button>
			</div>
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

const styles: Record<string, React.CSSProperties> = {
	container: {
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		padding: '6px 8px',
		borderBottom: '1px solid var(--vscode-widget-border)',
		backgroundColor: 'var(--vscode-editor-background)',
	},
	form: {
		display: 'flex',
		flex: 1,
		gap: '4px',
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
	iconButton: {
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
};
