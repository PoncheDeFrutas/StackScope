/**
 * A saved memory location preset.
 * Pure domain model — no VS Code imports.
 */
export interface MemoryPreset {
	/** Unique identifier */
	readonly id: string;
	/** Display name (e.g., "Stack Pointer", "Heap Start") */
	readonly name: string;
	/** Target expression (e.g., "$sp", "0x20000000", "&myVar") */
	readonly target: string;
	/** Optional description */
	readonly description?: string;
	/** Timestamp when created */
	readonly createdAt: number;
}

/**
 * Creates a new MemoryPreset.
 */
export function createMemoryPreset(
	id: string,
	name: string,
	target: string,
	description?: string
): MemoryPreset {
	return Object.freeze({
		id,
		name,
		target,
		description,
		createdAt: Date.now(),
	});
}

const QUICK_REGISTER_TARGETS = new Set(['$pc', '$sp', '$lr']);

export function isQuickRegisterTarget(target: string): boolean {
	return QUICK_REGISTER_TARGETS.has(normalizePresetTarget(target));
}

function normalizePresetTarget(target: string): string {
	return target.trim().replace(/\s+/g, ' ').toLowerCase();
}
