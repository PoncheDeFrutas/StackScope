import { useEffect, useState, type CSSProperties } from 'react';

interface RegisterEditDialogProps {
	expression: string;
	initialValue: string;
	error: string | null;
	isSubmitting: boolean;
	onCancel: () => void;
	onConfirm: (value: string) => void;
}

export function RegisterEditDialog({ expression, initialValue, error, isSubmitting, onCancel, onConfirm }: RegisterEditDialogProps): JSX.Element {
	const [value, setValue] = useState(initialValue);
	useEffect(() => setValue(initialValue), [initialValue]);
	const valid = value.trim().length > 0;
	return <div style={styles.backdrop} onMouseDown={() => !isSubmitting && onCancel()}><div style={styles.dialog} role="dialog" aria-modal="true" aria-label={`Edit ${expression}`} onMouseDown={(event) => event.stopPropagation()}>
		<div style={styles.title}>Write {expression}</div>
		<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} style={styles.input} disabled={isSubmitting} aria-label={`New value for ${expression}`} onKeyDown={(event) => {
			if (event.key === 'Escape' && !isSubmitting) onCancel();
			if (event.key === 'Enter' && valid && !isSubmitting) { event.preventDefault(); onConfirm(value.trim()); }
		}} />
		{error && <div style={styles.error}>{error}</div>}
		<div style={styles.actions}><button type="button" onClick={onCancel} disabled={isSubmitting}>Cancel</button><button type="button" disabled={!valid || isSubmitting} onClick={() => onConfirm(value.trim())}>{isSubmitting ? 'Writing…' : 'Confirm write'}</button></div>
	</div></div>;
}

const styles: Record<string, CSSProperties> = {
	backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
	dialog: { width: 360, maxWidth: 'calc(100vw - 32px)', padding: 16, borderRadius: 6, background: 'var(--vscode-editorWidget-background)', border: '1px solid var(--vscode-editorWidget-border)' },
	title: { fontWeight: 600, marginBottom: 10 }, input: { width: '100%', boxSizing: 'border-box', padding: '7px 8px', color: 'var(--vscode-input-foreground)', background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border)' },
	error: { marginTop: 8, color: 'var(--vscode-errorForeground)' }, actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
};
