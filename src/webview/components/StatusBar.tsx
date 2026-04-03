interface StatusBarProps {
	status: 'none' | 'running' | 'stopped';
	sessionId: string | null;
	documentAddress: string | null;
	error: string | null;
	changedByteCount?: number;
}

/**
 * Status bar showing session state and errors.
 */
export function StatusBar({
	status,
	sessionId,
	documentAddress,
	error,
	changedByteCount = 0,
}: StatusBarProps): JSX.Element {
	return (
		<div style={styles.container}>
			<div style={styles.left}>
				<StatusIndicator status={status} />
				{sessionId && (
					<span style={styles.sessionId}>Session: {sessionId.slice(0, 8)}...</span>
				)}
				{documentAddress && (
					<span style={styles.address}>Address: {documentAddress}</span>
				)}
				{documentAddress && changedByteCount > 0 && (
					<span style={styles.changedSummary}>
						Changed: {changedByteCount} {changedByteCount === 1 ? 'byte' : 'bytes'}
					</span>
				)}
			</div>
			{error && <div style={styles.error}>{error}</div>}
		</div>
	);
}

interface StatusIndicatorProps {
	status: 'none' | 'running' | 'stopped';
}

function StatusIndicator({ status }: StatusIndicatorProps): JSX.Element {
	const colors: Record<string, string> = {
		none: 'var(--vscode-charts-gray)',
		running: 'var(--vscode-charts-green)',
		stopped: 'var(--vscode-charts-yellow)',
	};

	const labels: Record<string, string> = {
		none: 'No Session',
		running: 'Running',
		stopped: 'Stopped',
	};

	return (
		<span style={styles.indicator}>
			<span
				style={{
					...styles.dot,
					backgroundColor: colors[status],
				}}
			/>
			{labels[status]}
		</span>
	);
}

const styles: Record<string, React.CSSProperties> = {
	container: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '4px 8px',
		borderTop: '1px solid var(--vscode-widget-border)',
		fontSize: '0.85em',
		color: 'var(--vscode-descriptionForeground)',
	},
	left: {
		display: 'flex',
		alignItems: 'center',
		gap: '12px',
	},
	indicator: {
		display: 'flex',
		alignItems: 'center',
		gap: '4px',
	},
	dot: {
		width: '8px',
		height: '8px',
		borderRadius: '50%',
	},
	sessionId: {
		opacity: 0.8,
	},
	address: {
		color: 'var(--vscode-debugTokenExpression-number)',
	},
	changedSummary: {
		color: 'var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)',
	},
	error: {
		color: 'var(--vscode-errorForeground)',
	},
};
