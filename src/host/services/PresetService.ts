import * as vscode from 'vscode';
import type { MemoryPreset } from '../../domain/presets/MemoryPreset.js';
import {
	createMemoryPreset,
	isQuickRegisterTarget,
} from '../../domain/presets/MemoryPreset.js';
import { SequentialTaskQueue } from '../../shared/SequentialTaskQueue.js';
import { reportHostError } from './HostErrorReporter.js';

const STORAGE_KEY = 'stackscope.presets';

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

	/** Gets all user presets. */
	getAll(): MemoryPreset[] {
		return [...this.userPresets];
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
			`preset_${crypto.randomUUID()}`,
			name.trim(),
			target.trim(),
			description
		);

		this.userPresets.push(preset);
		this.saveToStorage();
		return preset;
	}

	/** Deletes a user preset by ID. */
	delete(id: string): boolean {
		const index = this.userPresets.findIndex((p) => p.id === id);
		if (index === -1) {
			return false;
		}

		this.userPresets.splice(index, 1);
		this.saveToStorage();
		return true;
	}

	private loadFromStorage(): void {
		const stored = this.context.workspaceState.get<MemoryPreset[]>(STORAGE_KEY);
		if (Array.isArray(stored)) {
			this.userPresets = dedupeUserPresets(
				stored.filter((p) => !isQuickRegisterTarget(p.target))
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
