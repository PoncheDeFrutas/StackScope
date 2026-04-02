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

/**
 * Built-in register presets.
 */
export const BUILTIN_PRESETS: readonly MemoryPreset[] = Object.freeze([
	createMemoryPreset('builtin-pc', 'PC (Program Counter)', '$pc', 'Current instruction pointer'),
	createMemoryPreset('builtin-sp', 'SP (Stack Pointer)', '$sp', 'Top of the stack'),
	createMemoryPreset('builtin-lr', 'LR (Link Register)', '$lr', 'Return address'),
]);

/**
 * Checks if a preset is a built-in preset.
 */
export function isBuiltinPreset(preset: MemoryPreset): boolean {
	return preset.id.startsWith('builtin-');
}
