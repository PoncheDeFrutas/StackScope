/**
 * A single register item within a set.
 * Pure domain model - no VS Code imports.
 */
export interface RegisterItem {
	/** Register expression (e.g., "$pc", "x0", "sp") */
	readonly expression: string;
	/** Optional display label (defaults to expression if not provided) */
	readonly label?: string;
}

/**
 * A named collection of registers.
 * Pure domain model - no VS Code imports.
 */
export interface RegisterSet {
	/** Unique identifier */
	readonly id: string;
	/** Display name (e.g., "Core", "ARM General Purpose") */
	readonly name: string;
	/** List of registers in this set */
	readonly registers: readonly RegisterItem[];
	/** Optional description */
	readonly description?: string;
	/** Timestamp when created */
	readonly createdAt: number;
}

/**
 * Creates a new RegisterItem.
 */
export function createRegisterItem(
	expression: string,
	label?: string
): RegisterItem {
	return Object.freeze({ expression, label });
}

/**
 * Creates a new RegisterSet.
 */
export function createRegisterSet(
	id: string,
	name: string,
	registers: RegisterItem[],
	description?: string
): RegisterSet {
	return Object.freeze({
		id,
		name,
		registers: Object.freeze([...registers]),
		description,
		createdAt: Date.now(),
	});
}

/**
 * Built-in register sets.
 * V1: Only "Core" set with pc, sp, lr.
 */
export const BUILTIN_REGISTER_SETS: readonly RegisterSet[] = Object.freeze([
	createRegisterSet(
		'builtin-core',
		'Core',
		[
			createRegisterItem('$pc', 'PC'),
			createRegisterItem('$sp', 'SP'),
			createRegisterItem('$lr', 'LR'),
		],
		'Core registers: Program Counter, Stack Pointer, Link Register'
	),
]);

/**
 * Checks if a register set is a built-in set.
 */
export function isBuiltinRegisterSet(set: RegisterSet): boolean {
	return set.id.startsWith('builtin-');
}

/**
 * Value of a register after evaluation.
 */
export interface RegisterValue {
	/** Register expression that was evaluated */
	readonly expression: string;
	/** Display label */
	readonly label: string;
	/** Resolved value as hex string, or null if unavailable */
	readonly value: string | null;
	/** Error message if evaluation failed */
	readonly error?: string;
}
