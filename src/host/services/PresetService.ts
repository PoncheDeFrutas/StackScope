import * as vscode from 'vscode';
import type { MemoryPreset } from '../../domain/presets/MemoryPreset.js';
import {
	createMemoryPreset,
	BUILTIN_PRESETS,
	isBuiltinPreset,
	isQuickRegisterTarget,
} from '../../domain/presets/MemoryPreset.js';
import { SequentialTaskQueue } from '../../shared/SequentialTaskQueue.js';
import { reportHostError } from './HostErrorReporter.js';

const STORAGE_KEY = 'stackscope.presets';

/**
 * Generates a unique preset ID.
 */
function generatePresetId(): string {
	return `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Service for managing memory presets.
 * Stores user presets in workspace state.
 */
export class PresetService {
	private userPresets: MemoryPreset[] = [];
	private readonly writeQueue = new SequentialTaskQueue();

	constructor(private readonly context: vscode.ExtensionContext) {
		this.loadFromStorage();
	}

	/**
	 * Gets all presets (builtin + user).
	 */
	getAll(): MemoryPreset[] {
		return [...BUILTIN_PRESETS, ...this.userPresets];
	}

	/**
	 * Gets only user-defined presets.
	 */
	getUserPresets(): MemoryPreset[] {
		return [...this.userPresets];
	}

	/**
	 * Gets a preset by ID.
	 */
	get(id: string): MemoryPreset | undefined {
		// Check builtins first
		const builtin = BUILTIN_PRESETS.find((p) => p.id === id);
		if (builtin) {
			return builtin;
		}
		return this.userPresets.find((p) => p.id === id);
	}

	/**
	 * Saves a new user preset.
	 */
	save(name: string, target: string, description?: string): MemoryPreset {
		const existing = this.findUserPresetByNameTarget(name, target);
		if (existing) {
			return existing;
		}

		const preset = createMemoryPreset(
			generatePresetId(),
			name.trim(),
			target.trim(),
			description
		);

		this.userPresets.push(preset);
		this.saveToStorage();
		return preset;
	}

	/**
	 * Deletes a user preset by ID.
	 * Cannot delete builtin presets.
	 */
	delete(id: string): boolean {
		// Check if it's a builtin
		const builtin = BUILTIN_PRESETS.find((p) => p.id === id);
		if (builtin) {
			return false; // Cannot delete builtin
		}

		const index = this.userPresets.findIndex((p) => p.id === id);
		if (index === -1) {
			return false;
		}

		this.userPresets.splice(index, 1);
		this.saveToStorage();
		return true;
	}

	/**
	 * Updates a user preset.
	 */
	update(id: string, updates: Partial<Pick<MemoryPreset, 'name' | 'target' | 'description'>>): MemoryPreset | null {
		const index = this.userPresets.findIndex((p) => p.id === id);
		if (index === -1) {
			return null;
		}

		const existing = this.userPresets[index];
		const updated = createMemoryPreset(
			existing.id,
			updates.name ?? existing.name,
			updates.target ?? existing.target,
			updates.description ?? existing.description
		);

		// Preserve original createdAt
		const finalPreset: MemoryPreset = {
			...updated,
			createdAt: existing.createdAt,
		};

		this.userPresets[index] = finalPreset;
		this.saveToStorage();
		return finalPreset;
	}

	private loadFromStorage(): void {
		const stored = this.context.workspaceState.get<MemoryPreset[]>(STORAGE_KEY);
		if (Array.isArray(stored)) {
			this.userPresets = dedupeUserPresets(
				stored.filter((p) => !isBuiltinPreset(p) && !isQuickRegisterTarget(p.target))
			);
		}
	}

	private saveToStorage(): void {
		const snapshot = [...this.userPresets];
		void this.writeQueue.enqueue(() =>
			this.context.workspaceState.update(STORAGE_KEY, snapshot)
		).catch((error) => {
			reportHostError('PresetService.saveToStorage', error);
		});
	}

	private findUserPresetByNameTarget(name: string, target: string): MemoryPreset | undefined {
		const key = getPresetIdentityKey(name, target);
		return this.userPresets.find((preset) =>
			getPresetIdentityKey(preset.name, preset.target) === key
		);
	}
}

function dedupeUserPresets(presets: MemoryPreset[]): MemoryPreset[] {
	const seen = new Set<string>();
	const deduped: MemoryPreset[] = [];

	for (const preset of presets) {
		const key = getPresetIdentityKey(preset.name, preset.target);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduped.push(preset);
	}

	return deduped;
}

function getPresetIdentityKey(name: string, target: string): string {
	return `${normalizePresetPart(name)}\u0000${normalizePresetPart(target)}`;
}

function normalizePresetPart(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
