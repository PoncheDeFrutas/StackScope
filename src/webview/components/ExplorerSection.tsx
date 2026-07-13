import type { CSSProperties, ReactNode } from 'react';

interface ExplorerSectionProps {
	id: string;
	label: string;
	expanded: boolean;
	count?: number;
	onExpandedChange: (expanded: boolean) => void;
	children: ReactNode;
}

/** VS Code Explorer-style collapsible section shared by register views. */
export function ExplorerSection({ id, label, expanded, count, onExpandedChange, children }: ExplorerSectionProps): JSX.Element {
	return <section style={styles.section}>
		<button
			type="button"
			style={styles.header}
			onClick={() => onExpandedChange(!expanded)}
			aria-expanded={expanded}
			aria-controls={id}
		>
			<span aria-hidden="true" style={styles.chevron}>
				{expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
			</span>
			<span style={styles.label}>{label}</span>
			{count !== undefined && count > 0 && <span style={styles.count}>{count}</span>}
		</button>
		{expanded && <div id={id}>{children}</div>}
	</section>;
}

function ChevronRightIcon(): JSX.Element {
	return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
		<path d="m5 1.5 6 6-6 6-.7-.7 5.3-5.3-5.3-5.3z" />
	</svg>;
}

function ChevronDownIcon(): JSX.Element {
	return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
		<path d="m1.5 5 6 6 6-6-.7-.7-5.3 5.3-5.3-5.3z" />
	</svg>;
}

const styles: Record<string, CSSProperties> = {
	section: { borderBottom: '1px solid var(--vscode-widget-border)' },
	header: {
		display: 'flex', alignItems: 'center', width: '100%', minHeight: 24, padding: '3px 8px 3px 5px',
		border: 'none', background: 'var(--vscode-sideBarSectionHeader-background, transparent)',
		color: 'var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground))', cursor: 'pointer', textAlign: 'left',
	},
	chevron: { display: 'flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', flex: '0 0 16px' },
	label: { flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' },
	count: { minWidth: 16, padding: '0 5px', borderRadius: 8, background: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)', fontSize: 11, lineHeight: '16px', textAlign: 'center' },
};
