/**
 * Unit size for displaying memory values.
 * 1 = byte, 2 = word (16-bit), 4 = dword (32-bit), 8 = qword (64-bit), 16 = 128-bit (not commonly used but included for completeness).
 */
export type UnitSize = 1 | 2 | 4 | 8 | 16;

/**
 * Byte order for multi-byte values.
 */
export type Endianness = 'little' | 'big';

/**
 * Configuration for memory view display.
 * Pure domain model — no VS Code imports.
 */
export interface MemoryViewConfig {
	/** Number of units per row (default: 16) */
	readonly columns: number;
	/** Size of each display unit in bytes (default: 1) */
	readonly unitSize: UnitSize;
	/** Byte order for multi-byte units (default: 'little') */
	readonly endianness: Endianness;
	/** Total bytes to display (default: 4MB = 4 * 1024 * 1024) */
	readonly totalSize: number;
}

/** Default configuration values */
export const DEFAULT_CONFIG: MemoryViewConfig = {
	columns: 16,
	unitSize: 1,
	endianness: 'little',
	totalSize: 4 * 1024 * 1024, // 4MB
};

/** Minimum total size (256 bytes) */
export const MIN_TOTAL_SIZE = 256;

/** Maximum total size (16MB) */
export const MAX_TOTAL_SIZE = 16 * 1024 * 1024;

/** Valid column counts */
export const VALID_COLUMNS = [1, 4, 8, 16, 32] as const;

/** Valid unit sizes */
export const VALID_UNIT_SIZES: readonly UnitSize[] = [1, 2, 4, 8, 16];

/**
 * Creates a new MemoryViewConfig with defaults for missing values.
 */
export function createMemoryViewConfig(
	partial: Partial<MemoryViewConfig> = {}
): MemoryViewConfig {
	return Object.freeze({
		columns: partial.columns ?? DEFAULT_CONFIG.columns,
		unitSize: partial.unitSize ?? DEFAULT_CONFIG.unitSize,
		endianness: partial.endianness ?? DEFAULT_CONFIG.endianness,
		totalSize: partial.totalSize ?? DEFAULT_CONFIG.totalSize,
	});
}

/**
 * Validates a config and returns errors if any.
 */
export function validateConfig(config: MemoryViewConfig): string[] {
	const errors: string[] = [];

	if (!VALID_COLUMNS.includes(config.columns as typeof VALID_COLUMNS[number])) {
		errors.push(`Columns must be one of: ${VALID_COLUMNS.join(', ')}`);
	}

	if (!VALID_UNIT_SIZES.includes(config.unitSize)) {
		errors.push(`Unit size must be one of: ${VALID_UNIT_SIZES.join(', ')}`);
	}

	if (config.endianness !== 'little' && config.endianness !== 'big') {
		errors.push('Endianness must be "little" or "big"');
	}

	if (config.totalSize < MIN_TOTAL_SIZE) {
		errors.push(`Total size must be at least ${MIN_TOTAL_SIZE} bytes`);
	}

	if (config.totalSize > MAX_TOTAL_SIZE) {
		errors.push(`Total size must be at most ${MAX_TOTAL_SIZE} bytes`);
	}

	return errors;
}

/**
 * Calculates bytes per row based on config.
 */
export function bytesPerRow(config: MemoryViewConfig): number {
	return config.columns * config.unitSize;
}

/**
 * Formats a byte count as human-readable (e.g., "4 KB", "1 MB").
 */
export function formatByteSize(bytes: number): string {
	if (bytes >= 1024 * 1024) {
		const mb = bytes / (1024 * 1024);
		return mb % 1 === 0 ? `${mb} MB` : `${mb.toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		const kb = bytes / 1024;
		return kb % 1 === 0 ? `${kb} KB` : `${kb.toFixed(1)} KB`;
	}
	return `${bytes} B`;
}

/**
 * Parses a human-readable size string to bytes.
 * Accepts: "256", "1KB", "4 MB", "1024", etc.
 */
export function parseByteSize(input: string): number | null {
	const trimmed = input.trim().toUpperCase();

	// Match number with optional unit
	const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/);
	if (!match) {
		return null;
	}

	const value = parseFloat(match[1]);
	const unit = match[2] || 'B';

	const multipliers: Record<string, number> = {
		B: 1,
		KB: 1024,
		MB: 1024 * 1024,
		GB: 1024 * 1024 * 1024,
	};

	return Math.floor(value * multipliers[unit]);
}
