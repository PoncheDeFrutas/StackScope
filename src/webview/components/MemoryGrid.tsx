import type { CSSProperties } from 'react';

interface MemoryGridProps {
	address: string;
	data: number[];
	bytesPerRow?: number;
}

/**
 * Renders memory as hex rows.
 * Each row shows: address | hex bytes | ASCII
 */
export function MemoryGrid({
	address,
	data,
	bytesPerRow = 16,
}: MemoryGridProps): JSX.Element {
	const baseAddress = parseAddress(address);
	const rows: JSX.Element[] = [];

	for (let i = 0; i < data.length; i += bytesPerRow) {
		const rowBytes = data.slice(i, i + bytesPerRow);
		const rowAddress = baseAddress + BigInt(i);
		rows.push(
			<MemoryRow
				key={i}
				address={rowAddress}
				bytes={rowBytes}
				bytesPerRow={bytesPerRow}
			/>
		);
	}

	return (
		<div style={styles.container}>
			<table style={styles.table}>
				<thead>
					<tr style={styles.headerRow}>
						<th style={styles.addressHeader}>Address</th>
						<HeaderCells type="hex" />
						<th style={styles.spacer}></th>
						<HeaderCells type="ascii" />
					</tr>
				</thead>
				<tbody>{rows}</tbody>
			</table>
		</div>
	);
}

function HeaderCells({ type }: { type: 'hex' | 'ascii' }): JSX.Element {
	const cells: JSX.Element[] = [];
	for (let i = 0; i < 16; i++) {
		const label = i.toString(16).toUpperCase().padStart(2, '0');
		// Add extra gap after byte 7
		const style = i === 8 
			? { ...styles.headerCell, ...(type === 'hex' ? styles.hexCell : styles.asciiCell), paddingLeft: '12px' }
			: { ...styles.headerCell, ...(type === 'hex' ? styles.hexCell : styles.asciiCell) };
		cells.push(
			<th key={`${type}-${i}`} style={style}>
				{label}
			</th>
		);
	}
	return <>{cells}</>;
}

interface MemoryRowProps {
	address: bigint;
	bytes: number[];
	bytesPerRow: number;
}

function MemoryRow({ address, bytes, bytesPerRow }: MemoryRowProps): JSX.Element {
	const hexCells: JSX.Element[] = [];
	const asciiCells: JSX.Element[] = [];

	for (let i = 0; i < bytesPerRow; i++) {
		const byte = i < bytes.length ? bytes[i] : null;
		const hexValue = byte !== null ? byte.toString(16).padStart(2, '0').toUpperCase() : '  ';
		const asciiValue = byte !== null ? (isPrintable(byte) ? String.fromCharCode(byte) : '.') : ' ';

		// Add extra gap after byte 7
		const hexStyle = i === 8 
			? { ...styles.hexCell, paddingLeft: '12px' }
			: styles.hexCell;
		const asciiStyle = i === 8 
			? { ...styles.asciiCell, paddingLeft: '12px' }
			: styles.asciiCell;

		hexCells.push(
			<td key={`hex-${i}`} style={hexStyle}>{hexValue}</td>
		);
		asciiCells.push(
			<td key={`ascii-${i}`} style={asciiStyle}>{asciiValue}</td>
		);
	}

	return (
		<tr style={styles.dataRow}>
			<td style={styles.addressCell}>{formatAddress(address)}</td>
			{hexCells}
			<td style={styles.spacer}></td>
			{asciiCells}
		</tr>
	);
}

function parseAddress(addr: string): bigint {
	const cleaned = addr.trim().toLowerCase();
	if (cleaned.startsWith('0x')) {
		return BigInt(cleaned);
	}
	return BigInt('0x' + cleaned);
}

function formatAddress(addr: bigint): string {
	return '0x' + addr.toString(16).padStart(8, '0').toUpperCase();
}

function isPrintable(byte: number): boolean {
	return byte >= 0x20 && byte < 0x7f;
}

const styles: Record<string, CSSProperties> = {
	container: {
		fontFamily: 'var(--vscode-editor-font-family, Consolas, monospace)',
		fontSize: '13px',
		padding: '8px 12px',
		overflow: 'auto',
	},
	table: {
		borderCollapse: 'collapse',
		borderSpacing: 0,
	},
	headerRow: {
		borderBottom: '1px solid var(--vscode-widget-border)',
	},
	dataRow: {
		lineHeight: '1.6',
	},
	headerCell: {
		fontWeight: 'normal',
		color: 'var(--vscode-descriptionForeground)',
		fontSize: '11px',
		padding: '2px 0',
		textAlign: 'center',
	},
	addressHeader: {
		fontWeight: 'normal',
		color: 'var(--vscode-descriptionForeground)',
		fontSize: '11px',
		padding: '2px 16px 2px 0',
		textAlign: 'left',
	},
	addressCell: {
		color: 'var(--vscode-debugTokenExpression-number)',
		paddingRight: '16px',
		textAlign: 'left',
	},
	hexCell: {
		color: 'var(--vscode-foreground)',
		padding: '2px 4px',
		textAlign: 'center',
		width: '20px',
	},
	asciiCell: {
		color: 'var(--vscode-debugTokenExpression-string)',
		padding: '2px 4px',
		textAlign: 'center',
		width: '20px',
		backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
	},
	spacer: {
		width: '16px',
	},
};
