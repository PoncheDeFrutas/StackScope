import * as vscode from 'vscode';
import type { RegisterSet, RegisterItem } from '../../domain/registers/RegisterSet.js';
import {
	createRegisterSet,
	createRegisterItem,
	BUILTIN_REGISTER_SETS,
	isBuiltinRegisterSet,
} from '../../domain/registers/RegisterSet.js';

const STORAGE_KEY = 'stackscope.registerSets';
const SELECTED_SET_KEY = 'stackscope.selectedRegisterSet';

/**
 * Generates a unique register set ID.
 */
function generateSetId(): string {
	return `regset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Service for managing register sets.
 * Stores user sets in workspace state.
 */
export class RegisterSetService {
	private userSets: RegisterSet[] = [];
	private selectedSetId: string = BUILTIN_REGISTER_SETS[0].id;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.loadFromStorage();
	}

	/**
	 * Gets all register sets (builtin + user).
	 */
	getAll(): RegisterSet[] {
		return [...BUILTIN_REGISTER_SETS, ...this.userSets];
	}

	/**
	 * Gets only user-defined register sets.
	 */
	getUserSets(): RegisterSet[] {
		return [...this.userSets];
	}

	/**
	 * Gets a register set by ID.
	 */
	get(id: string): RegisterSet | undefined {
		// Check builtins first
		const builtin = BUILTIN_REGISTER_SETS.find((s) => s.id === id);
		if (builtin) {
			return builtin;
		}
		return this.userSets.find((s) => s.id === id);
	}

	/**
	 * Gets the currently selected register set ID.
	 */
	getSelectedId(): string {
		return this.selectedSetId;
	}

	/**
	 * Gets the currently selected register set.
	 */
	getSelected(): RegisterSet {
		const set = this.get(this.selectedSetId);
		// Fall back to first builtin if selected set was deleted
		return set ?? BUILTIN_REGISTER_SETS[0];
	}

	/**
	 * Selects a register set by ID.
	 */
	select(id: string): boolean {
		const set = this.get(id);
		if (!set) {
			return false;
		}
		this.selectedSetId = id;
		this.saveSelectedToStorage();
		return true;
	}

	/**
	 * Saves a new user register set.
	 */
	save(
		name: string,
		registers: Array<{ expression: string; label?: string }>,
		description?: string
	): RegisterSet {
		const items: RegisterItem[] = registers.map((r) =>
			createRegisterItem(r.expression, r.label)
		);

		const set = createRegisterSet(generateSetId(), name, items, description);

		this.userSets.push(set);
		this.saveToStorage();
		return set;
	}

	/**
	 * Deletes a user register set by ID.
	 * Cannot delete builtin sets.
	 */
	delete(id: string): boolean {
		// Check if it's a builtin
		const builtin = BUILTIN_REGISTER_SETS.find((s) => s.id === id);
		if (builtin) {
			return false; // Cannot delete builtin
		}

		const index = this.userSets.findIndex((s) => s.id === id);
		if (index === -1) {
			return false;
		}

		this.userSets.splice(index, 1);
		this.saveToStorage();

		// If deleted set was selected, switch to first builtin
		if (this.selectedSetId === id) {
			this.selectedSetId = BUILTIN_REGISTER_SETS[0].id;
			this.saveSelectedToStorage();
		}

		return true;
	}

	/**
	 * Updates a user register set.
	 */
	update(
		id: string,
		updates: Partial<{
			name: string;
			registers: Array<{ expression: string; label?: string }>;
			description: string;
		}>
	): RegisterSet | null {
		const index = this.userSets.findIndex((s) => s.id === id);
		if (index === -1) {
			return null;
		}

		const existing = this.userSets[index];
		const newRegisters = updates.registers
			? updates.registers.map((r) => createRegisterItem(r.expression, r.label))
			: [...existing.registers];

		const updated = createRegisterSet(
			existing.id,
			updates.name ?? existing.name,
			newRegisters as RegisterItem[],
			updates.description ?? existing.description
		);

		// Preserve original createdAt
		const finalSet: RegisterSet = {
			...updated,
			createdAt: existing.createdAt,
		};

		this.userSets[index] = finalSet;
		this.saveToStorage();
		return finalSet;
	}

	private loadFromStorage(): void {
		const stored = this.context.workspaceState.get<RegisterSet[]>(STORAGE_KEY);
		if (Array.isArray(stored)) {
			this.userSets = stored.filter((s) => !isBuiltinRegisterSet(s));
		}

		const selectedId = this.context.workspaceState.get<string>(SELECTED_SET_KEY);
		if (selectedId && this.get(selectedId)) {
			this.selectedSetId = selectedId;
		}
	}

	private saveToStorage(): void {
		this.context.workspaceState.update(STORAGE_KEY, this.userSets);
	}

	private saveSelectedToStorage(): void {
		this.context.workspaceState.update(SELECTED_SET_KEY, this.selectedSetId);
	}
}
