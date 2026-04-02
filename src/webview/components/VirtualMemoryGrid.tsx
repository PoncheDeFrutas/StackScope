import { useRef, useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { UnitSize, Endianness } from '../../domain/config/MemoryViewConfig.js';
import { calculateVisibleRange } from '../hooks/usePagedMemory.js';

/** Represents a byte value or null for unreadable memory */
export type MemoryByte = number | null;

/** Number format for display */
export type NumberFormat = 'hex' | 'dec' | 'oct' | 'bin';

/** Decoded bytes display mode */
export type DecodedMode = 'ascii' | 'uint8' | 'int8' | 'bin' | 'hidden';

interface VirtualMemoryGridProps {
	/** Base address (hex string) */
	baseAddress: string;
	/** Total size in bytes */
	totalSize: number;
	/** Function to get bytes for a range (returns null if not loaded) */
	getBytes: (offset: number, count: number) => (number | null)[] | null;
	/** Called when visible range changes */
	onVisibleRangeChange: (startOffset: number, endOffset: number) => void;
	/** Number of units per row */
	columns?: number;
	/** Size of each display unit in bytes */
	unitSize?: UnitSize;
	/** Byte order for multi-byte units */
	endianness?: Endianness;
	/** Number format for hex display */
	numberFormat?: NumberFormat;
	/** Decoded column mode (only shown when unitSize=1) */
	decodedMode?: DecodedMode;
	/** Set of changed byte offsets (for highlighting) */
	changedBytes?: Set<number>;
	/** Previous data for comparison (baseline) */
	previousData?: Map<number, number | null>;
}

const ROW_HEIGHT = 22;
const OVERSCAN_ROWS = 10;
const INITIAL_WINDOW_ROWS = 32;
const WINDOW_GROWTH_ROWS = 32;
const GROWTH_THRESHOLD_ROWS = 12;

// Layout constants - all in character units for monospace alignment
const ADDRESS_WIDTH_CH = 18;     // "0x" + 16 hex digits
const ADDRESS_HEX_GAP_CH = 2;    // Explicit gap between address and byte 00
const CELL_GAP_CH = 1;           // 1 character gap between cells
const MID_GAP_EXTRA_CH = 1;      // Extra gap at midpoint
const SECTION_GAP_CH = 3;        // Gap between hex and decoded sections

/**
 * Calculate cell width in characters based on format.
 * For 1-byte hex, this is 2 characters (e.g., "FF").
 */
function getHexCellWidth(unitSize: UnitSize, format: NumberFormat): number {
	switch (format) {
		case 'hex':
			return unitSize * 2;
		case 'dec':
			return getDecWidth(unitSize);
		case 'oct':
			return Math.ceil((unitSize * 8) / 3);
		case 'bin':
			return unitSize * 8;
		default:
			return unitSize * 2;
	}
}

function getDecWidth(unitSize: UnitSize): number {
	const maxValues: Record<UnitSize, number> = {
		1: 3,   // 255
		2: 5,   // 65535
		4: 10,  // 4294967295
		8: 20,  // 18446744073709551615
		16: 39,
	};
	return maxValues[unitSize] ?? unitSize * 3;
}

/**
 * Decoded cell width MUST match hex cell width for 1:1 alignment.
 * For standard hex mode with 1-byte units, both hex and decoded use 2ch cells.
 */
function getDecodedCellWidth(hexCellWidth: number, _mode: DecodedMode): number {
	// Always match hex cell width for perfect 1:1 alignment
	return hexCellWidth;
}

/**
 * Virtualized memory grid with lazy loading support.
 * Only renders visible rows for performance with large memory regions.
 */
export function VirtualMemoryGrid({
	baseAddress,
	totalSize,
	getBytes,
	onVisibleRangeChange,
	columns = 16,
	unitSize = 1,
	endianness = 'little',
	numberFormat = 'hex',
	decodedMode = 'ascii',
	changedBytes,
	previousData,
}: VirtualMemoryGridProps): JSX.Element {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(400);
	const [revealedSize, setRevealedSize] = useState(0);

	const bytesPerRow = columns * unitSize;
	const initialWindowBytes = bytesPerRow * INITIAL_WINDOW_ROWS;
	const growthWindowBytes = bytesPerRow * WINDOW_GROWTH_ROWS;
	const effectiveRevealedSize = revealedSize > 0 ? revealedSize : initialWindowBytes;
	const visibleTotalSize = Math.max(bytesPerRow, Math.min(totalSize, effectiveRevealedSize));

	// Cell width calculation - same for both hex and decoded
	const cellWidthCh = getHexCellWidth(unitSize, numberFormat);
	const decodedCellWidthCh = getDecodedCellWidth(cellWidthCh, decodedMode);

	const totalRows = Math.ceil(visibleTotalSize / bytesPerRow);
	const totalHeight = totalRows * ROW_HEIGHT;

	useEffect(() => {
		setRevealedSize(Math.min(totalSize, initialWindowBytes));
		setScrollTop(0);
	}, [baseAddress, totalSize, initialWindowBytes]);

	const { startRow, endRow } = calculateVisibleRange(
		scrollTop,
		viewportHeight,
		ROW_HEIGHT,
		bytesPerRow,
		visibleTotalSize
	);

	const overscanStartRow = Math.max(0, startRow - OVERSCAN_ROWS);
	const overscanEndRow = Math.min(totalRows, endRow + OVERSCAN_ROWS);

	useEffect(() => {
		const loadStartOffset = overscanStartRow * bytesPerRow;
		const loadEndOffset = Math.min(overscanEndRow * bytesPerRow, visibleTotalSize);
		onVisibleRangeChange(loadStartOffset, loadEndOffset);
	}, [overscanStartRow, overscanEndRow, bytesPerRow, visibleTotalSize, onVisibleRangeChange]);

	useEffect(() => {
		if (visibleTotalSize >= totalSize) return;
		const nearBottomPx = ROW_HEIGHT * GROWTH_THRESHOLD_ROWS;
		const scrollBottom = scrollTop + viewportHeight;
		if (scrollBottom < totalHeight - nearBottomPx) return;
		setRevealedSize((prev) => Math.min(totalSize, prev + growthWindowBytes));
	}, [scrollTop, viewportHeight, totalHeight, totalSize, visibleTotalSize, growthWindowBytes]);

	const handleScroll = useCallback(() => {
		if (containerRef.current) {
			setScrollTop(containerRef.current.scrollTop);
		}
	}, []);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setViewportHeight(entry.contentRect.height);
			}
		});
		observer.observe(container);
		setViewportHeight(container.clientHeight);
		return () => observer.disconnect();
	}, []);

	const baseAddr = parseAddress(baseAddress);
	const showDecoded = unitSize === 1 && decodedMode !== 'hidden';
	const midPoint = Math.floor(columns / 2);

	const rows: JSX.Element[] = [];
	for (let row = overscanStartRow; row < overscanEndRow; row++) {
		const rowOffset = row * bytesPerRow;
		const rowAddress = baseAddr + BigInt(rowOffset);
		const rowBytes = getBytes(rowOffset, bytesPerRow);

		rows.push(
			<MemoryRow
				key={row}
				address={rowAddress}
				bytes={rowBytes}
				rowOffset={rowOffset}
				columns={columns}
				unitSize={unitSize}
				endianness={endianness}
				numberFormat={numberFormat}
				decodedMode={decodedMode}
				showDecoded={showDecoded}
				cellWidthCh={cellWidthCh}
				decodedCellWidthCh={decodedCellWidthCh}
				midPoint={midPoint}
				changedBytes={changedBytes}
			/>
		);
	}

	return (
		<div ref={containerRef} style={styles.container} onScroll={handleScroll}>
			<div style={{ ...styles.innerContainer, height: totalHeight }}>
				<HeaderRow
					columns={columns}
					unitSize={unitSize}
					showDecoded={showDecoded}
					cellWidthCh={cellWidthCh}
					decodedCellWidthCh={decodedCellWidthCh}
					midPoint={midPoint}
				/>
				<div
					style={{
						position: 'absolute',
						top: ROW_HEIGHT + overscanStartRow * ROW_HEIGHT,
						left: 0,
						right: 0,
					}}
				>
					{rows}
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Header Row
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderRowProps {
	columns: number;
	unitSize: UnitSize;
	showDecoded: boolean;
	cellWidthCh: number;
	decodedCellWidthCh: number;
	midPoint: number;
}

function HeaderRow({
	columns,
	unitSize,
	showDecoded,
	cellWidthCh,
	decodedCellWidthCh,
	midPoint,
}: HeaderRowProps): JSX.Element {
	const hexHeaders: JSX.Element[] = [];
	const decodedHeaders: JSX.Element[] = [];

	for (let i = 0; i < columns; i++) {
		const offset = i * unitSize;
		// Header label: "00", "01", ... "0F"
		const label = offset.toString(16).toUpperCase().padStart(2, '0');
		// Pad/truncate to cell width, right-aligned
		const paddedLabel = label.slice(-cellWidthCh).padStart(cellWidthCh, ' ');

		// Add mid-gap before midpoint
		if (i === midPoint) {
			hexHeaders.push(<MidGap key="hex-mid" />);
			if (showDecoded) {
				decodedHeaders.push(<MidGap key="dec-mid" />);
			}
		}

		hexHeaders.push(
			<ByteCell key={`hex-h-${i}`} widthCh={cellWidthCh} variant="header">
				{paddedLabel}
			</ByteCell>
		);

		if (showDecoded) {
			const decodedLabel = label.slice(-decodedCellWidthCh).padStart(decodedCellWidthCh, ' ');
			decodedHeaders.push(
				<ByteCell key={`dec-h-${i}`} widthCh={decodedCellWidthCh} variant="header">
					{decodedLabel}
				</ByteCell>
			);
		}
	}

	return (
		<div style={styles.row}>
			<div style={styles.addressCell}>{'Address'.padEnd(ADDRESS_WIDTH_CH)}</div>
			<AddressGap />
			<div style={styles.cellGroup}>{hexHeaders}</div>
			{showDecoded && (
				<>
					<SectionGap />
					<div style={styles.cellGroup}>{decodedHeaders}</div>
				</>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory Row
// ─────────────────────────────────────────────────────────────────────────────

interface MemoryRowProps {
	address: bigint;
	bytes: (number | null)[] | null;
	rowOffset: number;
	columns: number;
	unitSize: UnitSize;
	endianness: Endianness;
	numberFormat: NumberFormat;
	decodedMode: DecodedMode;
	showDecoded: boolean;
	cellWidthCh: number;
	decodedCellWidthCh: number;
	midPoint: number;
	changedBytes?: Set<number>;
}

function MemoryRow({
	address,
	bytes,
	rowOffset,
	columns,
	unitSize,
	endianness,
	numberFormat,
	decodedMode,
	showDecoded,
	cellWidthCh,
	decodedCellWidthCh,
	midPoint,
	changedBytes,
}: MemoryRowProps): JSX.Element {
	const hexCells: JSX.Element[] = [];
	const decodedCells: JSX.Element[] = [];

	for (let col = 0; col < columns; col++) {
		const startIdx = col * unitSize;

		// Add mid-gap before midpoint
		if (col === midPoint) {
			hexCells.push(<MidGap key="hex-mid" />);
			if (showDecoded) {
				decodedCells.push(<MidGap key="dec-mid" />);
			}
		}

		const unitBytes = bytes ? bytes.slice(startIdx, startIdx + unitSize) : null;
		const isLoading = bytes === null;
		const isUnreadable = unitBytes?.some((b) => b === null) ?? false;
		const unitChanged = changedBytes && unitBytes?.some((_, i) =>
			changedBytes.has(rowOffset + startIdx + i)
		);

		// Format hex content
		let hexContent: string;
		if (isLoading) {
			hexContent = '··'.padStart(cellWidthCh, '·');
		} else if (isUnreadable) {
			hexContent = '~~'.padStart(cellWidthCh, '~');
		} else {
			hexContent = formatUnit(unitBytes!, unitSize, endianness, numberFormat);
		}

		const hexVariant = isLoading ? 'loading' : isUnreadable ? 'unreadable' : unitChanged ? 'changed' : 'hex';

		hexCells.push(
			<ByteCell key={`hex-${col}`} widthCh={cellWidthCh} variant={hexVariant}>
				{hexContent}
			</ByteCell>
		);

		// Format decoded content (same width as hex for 1:1 alignment)
		if (showDecoded) {
			const byte = unitBytes && unitBytes.length > 0 ? unitBytes[0] : null;
			let decodedContent: string;

			if (isLoading) {
				decodedContent = '··'.padStart(decodedCellWidthCh, '·');
			} else if (byte === null) {
				decodedContent = '~~'.padStart(decodedCellWidthCh, '~');
			} else {
				decodedContent = formatDecodedByte(byte, decodedMode, decodedCellWidthCh);
			}

			const decodedVariant = isLoading ? 'loading' : byte === null ? 'unreadable' : unitChanged ? 'changed' : 'decoded';

			decodedCells.push(
				<ByteCell key={`dec-${col}`} widthCh={decodedCellWidthCh} variant={decodedVariant}>
					{decodedContent}
				</ByteCell>
			);
		}
	}

	return (
		<div style={styles.row}>
			<div style={styles.addressCell}>{formatAddress(address)}</div>
			<AddressGap />
			<div style={styles.cellGroup}>{hexCells}</div>
			{showDecoded && (
				<>
					<SectionGap />
					<div style={styles.cellGroup}>{decodedCells}</div>
				</>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Cell Components
// ─────────────────────────────────────────────────────────────────────────────

type CellVariant = 'header' | 'hex' | 'decoded' | 'loading' | 'unreadable' | 'changed';

interface ByteCellProps {
	widthCh: number;
	variant: CellVariant;
	children: string;
}

/**
 * A single byte cell - used for both hex and decoded values.
 * Same font, same sizing, same structure for perfect alignment.
 */
function ByteCell({ widthCh, variant, children }: ByteCellProps): JSX.Element {
	const variantStyle = variantStyles[variant] || {};
	return (
		<span
			style={{
				...styles.byteCell,
				width: `${widthCh}ch`,
				...variantStyle,
			}}
		>
			{children}
		</span>
	);
}

/** Extra gap at midpoint */
function MidGap(): JSX.Element {
	return <span style={{ width: `${MID_GAP_EXTRA_CH}ch`, flexShrink: 0 }}> </span>;
}

/** Gap between address column and first hex byte */
function AddressGap(): JSX.Element {
	return <span style={{ width: `${ADDRESS_HEX_GAP_CH}ch`, flexShrink: 0 }} aria-hidden="true"> </span>;
}

/** Gap between hex and decoded sections */
function SectionGap(): JSX.Element {
	return <span style={{ width: `${SECTION_GAP_CH}ch`, flexShrink: 0 }}>{''.padStart(SECTION_GAP_CH)}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatUnit(
	bytes: (number | null)[],
	unitSize: UnitSize,
	endianness: Endianness,
	format: NumberFormat
): string {
	if (bytes.length === 0 || bytes.some((b) => b === null)) {
		const width = getHexCellWidth(unitSize, format);
		return '~'.repeat(width);
	}

	const orderedBytes = endianness === 'little' ? [...bytes].reverse() : bytes;
	let value = 0n;
	for (const b of orderedBytes) {
		value = (value << 8n) | BigInt(b as number);
	}

	return formatValue(value, unitSize, format);
}

function formatValue(value: bigint, unitSize: UnitSize, format: NumberFormat): string {
	switch (format) {
		case 'hex':
			return value.toString(16).toUpperCase().padStart(unitSize * 2, '0');
		case 'dec':
			return value.toString(10).padStart(getDecWidth(unitSize), ' ');
		case 'oct':
			return value.toString(8).padStart(Math.ceil((unitSize * 8) / 3), '0');
		case 'bin':
			return value.toString(2).padStart(unitSize * 8, '0');
		default:
			return value.toString(16).toUpperCase().padStart(unitSize * 2, '0');
	}
}

/**
 * Format a decoded byte to exactly match hex cell width.
 * For 2-character hex cells, decoded must also be 2 characters.
 */
function formatDecodedByte(byte: number, mode: DecodedMode, width: number): string {
	let char: string;

		switch (mode) {
			case 'ascii':
				if (byte >= 0x20 && byte < 0x7f) {
					// Printable: right-pad with space to width
					char = String.fromCharCode(byte);
				} else if (byte === 0x00) {
					char = '.'; // Null placeholder (compact)
				} else if (byte === 0x0a) {
				char = '↵'; // Newline
			} else if (byte === 0x0d) {
				char = '⏎'; // Carriage return
			} else if (byte === 0x09) {
				char = '⇥'; // Tab
			} else if (byte === 0x20) {
				char = '␣'; // Space (visible)
			} else {
				char = '·'; // Non-printable placeholder
			}
			// Pad to width (right-align single char in 2ch cell)
			return char.padStart(width, ' ');

		case 'uint8':
			// 0-255, right-aligned
			return byte.toString(10).padStart(width, ' ');

		case 'int8': {
			const signed = byte > 127 ? byte - 256 : byte;
			return signed.toString(10).padStart(width, ' ');
		}

		case 'bin':
			return byte.toString(2).padStart(8, '0').slice(-width);

		case 'hidden':
		default:
			return ' '.repeat(width);
	}
}

function parseAddress(addr: string): bigint {
	try {
		const cleaned = addr.trim().toLowerCase();
		if (cleaned.startsWith('0x')) {
			return BigInt(cleaned);
		}
		if (/^\d+$/.test(cleaned)) {
			return BigInt(cleaned);
		}
		return BigInt(`0x${cleaned}`);
	} catch {
		return 0n;
	}
}

function formatAddress(addr: bigint): string {
	return '0x' + addr.toString(16).padStart(16, '0').toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles - shared primitives for both hex and decoded
// ─────────────────────────────────────────────────────────────────────────────

const FONT_FAMILY = 'var(--vscode-editor-font-family, Consolas, "Courier New", monospace)';
const FONT_SIZE = '13px';
const LINE_HEIGHT = `${ROW_HEIGHT}px`;

const styles: Record<string, CSSProperties> = {
	container: {
		fontFamily: FONT_FAMILY,
		fontSize: FONT_SIZE,
		lineHeight: LINE_HEIGHT,
		overflow: 'auto',
		height: '100%',
		position: 'relative',
	},
	innerContainer: {
		position: 'relative',
		width: 'fit-content',
		minWidth: '100%',
	},
	// Unified row style for header and data
	row: {
		display: 'flex',
		alignItems: 'center',
		height: ROW_HEIGHT,
		lineHeight: LINE_HEIGHT,
		fontFamily: FONT_FAMILY,
		fontSize: FONT_SIZE,
		whiteSpace: 'pre',
		paddingLeft: '8px',
		paddingRight: '8px',
		borderBottom: '1px solid transparent',
	},
	// Address column - same font as everything else
	addressCell: {
		width: `${ADDRESS_WIDTH_CH}ch`,
		minWidth: `${ADDRESS_WIDTH_CH}ch`,
		flexShrink: 0,
		color: 'var(--vscode-debugTokenExpression-number)',
		fontFamily: FONT_FAMILY,
		fontSize: FONT_SIZE,
		lineHeight: LINE_HEIGHT,
		whiteSpace: 'pre',
	},
	// Container for a group of byte cells
	cellGroup: {
		display: 'flex',
		alignItems: 'center',
		gap: `${CELL_GAP_CH}ch`,
		fontFamily: FONT_FAMILY,
		fontSize: FONT_SIZE,
		lineHeight: LINE_HEIGHT,
	},
	// Individual byte cell - exact same for hex and decoded
	byteCell: {
		display: 'inline-block',
		boxSizing: 'border-box',
		textAlign: 'center',
		fontFamily: FONT_FAMILY,
		fontSize: FONT_SIZE,
		lineHeight: LINE_HEIGHT,
		whiteSpace: 'pre',
		flexShrink: 0,
		overflow: 'hidden',
	},
};

// Variant-specific styles
const variantStyles: Record<CellVariant, CSSProperties> = {
	header: {
		color: 'var(--vscode-descriptionForeground)',
		fontWeight: 'normal',
	},
	hex: {
		color: 'var(--vscode-foreground)',
	},
	decoded: {
		color: 'var(--vscode-debugTokenExpression-string)',
		backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
	},
	loading: {
		color: 'var(--vscode-disabledForeground)',
		opacity: 0.4,
	},
	unreadable: {
		color: 'var(--vscode-disabledForeground)',
		opacity: 0.6,
	},
	changed: {
		backgroundColor: 'var(--vscode-diffEditor-insertedTextBackground, rgba(155, 185, 85, 0.2))',
		color: 'var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)',
	},
};
