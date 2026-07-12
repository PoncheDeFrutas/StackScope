import type { CSSProperties, ReactNode } from 'react';

interface WriteDialogShellProps {
	title: string;
	ariaLabel: string;
	meta?: ReactNode;
	children: ReactNode;
	preview: ReactNode;
	error: string | null;
	isSubmitting: boolean;
	confirmDisabled: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}

export function WriteDialogShell({ title, ariaLabel, meta, children, preview, error, isSubmitting, confirmDisabled, onCancel, onConfirm }: WriteDialogShellProps): JSX.Element {
	return (
		<div style={styles.backdrop} onMouseDown={() => !isSubmitting && onCancel()}>
			<div style={styles.dialog} role="dialog" aria-modal="true" aria-label={ariaLabel} onMouseDown={(event) => event.stopPropagation()}>
				<div style={styles.title}>{title}</div>
				{meta && <div style={styles.meta}>{meta}</div>}
				{children}
				<div style={styles.preview}>{preview}</div>
				{error && <div style={styles.error}>{error}</div>}
				<div style={styles.actions}>
					<button type="button" onClick={onCancel} disabled={isSubmitting} style={styles.secondaryButton}>Cancel</button>
					<button type="button" onClick={onConfirm} disabled={confirmDisabled || isSubmitting} style={styles.primaryButton}>{isSubmitting ? 'Writing…' : 'Confirm write'}</button>
				</div>
			</div>
		</div>
	);
}

export const writeDialogControlStyle: CSSProperties = {
	height: 30,
	boxSizing: 'border-box',
	padding: '0 8px',
	color: 'var(--vscode-input-foreground)',
	background: 'var(--vscode-input-background)',
	border: '1px solid var(--vscode-input-border)',
};

const styles: Record<string, CSSProperties> = {
	backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
	dialog: { width: 420, maxWidth: 'calc(100vw - 32px)', padding: 16, borderRadius: 6, background: 'var(--vscode-editorWidget-background)', border: '1px solid var(--vscode-editorWidget-border)' },
	title: { fontWeight: 600, marginBottom: 10 },
	meta: { display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 12, color: 'var(--vscode-descriptionForeground)', fontSize: 12 },
	preview: { marginTop: 8, color: 'var(--vscode-descriptionForeground)', fontFamily: 'var(--vscode-editor-font-family)', fontSize: 12 },
	error: { marginTop: 8, color: 'var(--vscode-errorForeground)' },
	actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
	secondaryButton: { minHeight: 30, padding: '0 12px', border: 'none', color: 'var(--vscode-button-secondaryForeground)', background: 'var(--vscode-button-secondaryBackground)' },
	primaryButton: { minHeight: 30, padding: '0 12px', border: 'none', color: 'var(--vscode-button-foreground)', background: 'var(--vscode-button-background)' },
};
