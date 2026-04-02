import type { CSSProperties } from 'react';
import type { UnitSize, Endianness } from '../../domain/config/MemoryViewConfig.js';

/** Represents a byte value or null for unreadable memory */
export type MemoryByte = number | null;

interface MemoryGridProps {
	address: string;
	data: MemoryByte[];
	columns?: number;
	unitSize?: UnitSize;
	endianness?: Endianness;
}

/**
 * Renders memory as hex rows with ASCII decode.
 * Supports unreadable bytes (shown as ~~), configurable columns,
 * unit sizes (1/2/4/8 bytes), and endianness.
 */
export function MemoryGrid({
	address,
	data,
	columns = 16,
	unitSize = 1,
	endianness = 'little',
}: MemoryGridProps): JSX.Element {
	const baseAddress = parseAddress(address);
	const bytesPerRow = columns * unitSize;
	const rows: JSX.Element[] = [];

	for (let i = 0; i < data.length; i += bytesPerRow) {
		const rowBytes = data.slice(i, i + bytesPerRow);
		const rowAddress = baseAddress + BigInt(i);
		rows.push(
			<MemoryRow
				key={i}
				address={rowAddress}
				bytes={rowBytes}
				columns={columns}
				unitSize={unitSize}
				endianness={endianness}
			/>
		);
	}

	return (
		<div style={styles.container}>
			<table style={styles.table}>
				<thead>
					<tr style={styles.headerRow}>
						<th style={styles.addressHeader}>Address</th>
						<HeaderCells type="hex" columns={columns} unitSize={unitSize} />
						<th style={styles.spacer}></th>
						<HeaderCells type="ascii" columns={columns} unitSize={unitSize} />
					</tr>
				</thead>
				<tbody>{rows}</tbody>
			</table>
		</div>
	);
}

interface HeaderCellsProps {
	type: 'hex' | 'ascii';
	columns: number;
	unitSize: UnitSize;
}

function HeaderCells({ type, columns, unitSize }: HeaderCellsProps): JSX.Element {
	const cells: JSX.Element[] = [];
	const bytesPerRow = columns * unitSize;
	const midPoint = Math.floor(columns / 2);

	if (type === 'hex') {
		// For hex, show unit-based offsets
		for (let i = 0; i < columns; i++) {
			const offset = i * unitSize;
			const label = offset.toString(16).toUpperCase().padStart(2, '0');
			const isAfterMid = i === midPoint;
			const style = isAfterMid
				? { ...styles.headerCell, ...styles.hexCell, paddingLeft: '12px' }
				: { ...styles.headerCell, ...styles.hexCell };
			cells.push(
				<th key={`hex-${i}`} style={style}>
					{label}
				</th>
			);
		}
	} else {
		// For ASCII, show byte offsets
		for (let i = 0; i < bytesPerRow; i++) {
			const label = i.toString(16).toUpperCase().padStart(2, '0');
			const midByte = Math.floor(bytesPerRow / 2);
			const isAfterMid = i === midByte;
			const style = isAfterMid
				? { ...styles.headerCell, ...styles.asciiCell, paddingLeft: '8px' }
				: { ...styles.headerCell, ...styles.asciiCell };
			cells.push(
				<th key={`ascii-${i}`} style={style}>
					{label}
				</th>
			);
		}
	}
	return <>{cells}</>;
}

interface MemoryRowProps {
	address: bigint;
	bytes: MemoryByte[];
	columns: number;
	unitSize: UnitSize;
	endianness: Endianness;
}

function MemoryRow({ address, bytes, columns, unitSize, endianness }: MemoryRowProps): JSX.Element {
	const hexCells: JSX.Element[] = [];
	const asciiCells: JSX.Element[] = [];
	const bytesPerRow = columns * unitSize;
	const midPoint = Math.floor(columns / 2);
	const midByte = Math.floor(bytesPerRow / 2);

	// Build hex cells (grouped by unitSize)
	for (let col = 0; col < columns; col++) {
		const startIdx = col * unitSize;
		const unitBytes = bytes.slice(startIdx, startIdx + unitSize);
		const hexValue = formatUnit(unitBytes, unitSize, endianness);
		const isUnreadable = unitBytes.some((b) => b === null);
		const isAfterMid = col === midPoint;

		const hexStyle: CSSProperties = {
			...styles.hexCell,
			...(isAfterMid ? { paddingLeft: '12px' } : {}),
			...(isUnreadable ? styles.unreadableCell : {}),
		};

		hexCells.push(
			<td key={`hex-${col}`} style={hexStyle}>
				{hexValue}
			</td>
		);
	}

	// Build ASCII cells (always byte-by-byte)
	for (let i = 0; i < bytesPerRow; i++) {
		const byte = i < bytes.length ? bytes[i] : null;
		const asciiValue = formatAsciiByte(byte);
		const isUnreadable = byte === null;
		const isAfterMid = i === midByte;

		const asciiStyle: CSSProperties = {
			...styles.asciiCell,
			...(isAfterMid ? { paddingLeft: '8px' } : {}),
			...(isUnreadable ? styles.unreadableAscii : {}),
		};

		asciiCells.push(
			<td key={`ascii-${i}`} style={asciiStyle}>
				{asciiValue}
			</td>
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

function formatUnit(bytes: MemoryByte[], unitSize: UnitSize, endianness: Endianness): string {
	// Check if any byte is unreadable
	if (bytes.length === 0 || bytes.some((b) => b === null)) {
		// Return ~~ pattern for unreadable
		return '~'.repeat(unitSize * 2);
	}

	// Reorder bytes based on endianness for display
	const orderedBytes = endianness === 'little' ? [...bytes].reverse() : bytes;

	return orderedBytes.map((b) => (b as number).toString(16).padStart(2, '0').toUpperCase()).join('');
}

function formatAsciiByte(byte: MemoryByte): string {
	if (byte === null) {
		return '~';
	}
	return isPrintable(byte) ? String.fromCharCode(byte) : '.';
}

function parseAddress(addr: string): bigint {
	const cleaned = addr.trim().toLowerCase();
	if (cleaned.startsWith('0x')) {
		return BigInt(cleaned);
	}
	return BigInt('0x' + cleaned);
}

function formatAddress(addr: bigint): string {
	// Use 16 chars for 64-bit addresses
	return '0x' + addr.toString(16).padStart(16, '0').toUpperCase();
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
		whiteSpace: 'nowrap',
	},
	hexCell: {
		color: 'var(--vscode-foreground)',
		padding: '2px 4px',
		textAlign: 'center',
		fontFamily: 'var(--vscode-editor-font-family, Consolas, monospace)',
	},
	asciiCell: {
		color: 'var(--vscode-debugTokenExpression-string)',
		padding: '2px 2px',
		textAlign: 'center',
		width: '12px',
		backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
	},
	unreadableCell: {
		color: 'var(--vscode-disabledForeground)',
		opacity: 0.6,
	},
	unreadableAscii: {
		color: 'var(--vscode-disabledForeground)',
		opacity: 0.6,
	},
	spacer: {
		width: '16px',
	},
};
