import type { CSSProperties } from 'react';
import type { WatchpointSnapshot, WatchpointSupportSnapshot } from '../../protocol/methods.js';

interface WatchpointsPanelProps {
	watchpoints: WatchpointSnapshot[];
	support: WatchpointSupportSnapshot;
	hitIds: readonly string[];
	error: string | null;
	onRemove: (id: string) => void;
}

export function WatchpointsPanel({ watchpoints, support, hitIds, error, onRemove }: WatchpointsPanelProps): JSX.Element {
	return <div style={styles.content}>
			{error && <div role="alert" style={styles.error}>{error}</div>}
			{!support.dataBreakpoints && !support.gdbRegisterFallback ? <div style={styles.message}>This debugger does not support watchpoints.</div>
			: !support.dataBreakpoints ? <div style={styles.message}>Register watchpoints use the GDB fallback.</div>
			: watchpoints.length === 0 ? <div style={styles.message}>No StackScope watchpoints in this session.</div>
			: watchpoints.map((watchpoint) => <div key={watchpoint.id} style={{ ...styles.item, ...(hitIds.includes(watchpoint.id) ? styles.hit : {}) }}>
				<div><strong>{watchpoint.target.kind === 'register' ? watchpoint.target.label : watchpoint.target.address}</strong><br /><span style={styles.meta}>{watchpoint.backend.toUpperCase()} · {watchpoint.accessType} · {watchpoint.verified ? 'Verified' : watchpoint.message ?? 'Unverified'}</span></div>
				<button type="button" onClick={() => onRemove(watchpoint.id)} style={styles.remove}>Remove</button>
			</div>)}
	</div>;
}

const styles: Record<string, CSSProperties> = {
	content: {},
	message: { padding: 12, color: 'var(--vscode-descriptionForeground)', fontSize: 12 },
	error: { padding: '8px 10px', color: 'var(--vscode-inputValidation-errorForeground, var(--vscode-errorForeground))', background: 'var(--vscode-inputValidation-errorBackground)', borderBottom: '1px solid var(--vscode-inputValidation-errorBorder)' },
	item: { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderTop: '1px solid var(--vscode-widget-border)', fontSize: 12 },
	hit: { background: 'var(--vscode-list-activeSelectionBackground)' },
	meta: { color: 'var(--vscode-descriptionForeground)' },
	remove: { alignSelf: 'center', border: 'none', padding: '3px 7px', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', cursor: 'pointer' },
};
