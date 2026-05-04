import * as assert from 'assert';
import type * as vscode from 'vscode';
import { PresetService } from '../host/services/PresetService.js';
import type { MemoryPreset } from '../domain/presets/MemoryPreset.js';

suite('PresetService', () => {
	test('save reuses existing preset with same name and target', () => {
		const context = createMockContext();
		const service = new PresetService(context);

		const first = service.save('Argument register', ' $x0 ');
		const second = service.save(' argument register ', '$X0');

		assert.strictEqual(second.id, first.id);
		assert.deepStrictEqual(service.getUserPresets().map((preset) => preset.id), [first.id]);
	});

	test('does not expose quick register presets in saved list', () => {
		const service = new PresetService(createMockContext());

		assert.deepStrictEqual(
			service.getAll().map((preset) => preset.target),
			[]
		);
	});

	test('load dedupes stored user presets by name and target', () => {
		const stored: MemoryPreset[] = [
			{
				id: 'preset-1',
				name: 'Argument register',
				target: '$x0',
				createdAt: 1,
			},
			{
				id: 'preset-2',
				name: ' argument register ',
				target: ' $X0 ',
				createdAt: 2,
			},
		];

		const service = new PresetService(createMockContext(stored));

		assert.deepStrictEqual(service.getUserPresets().map((preset) => preset.id), ['preset-1']);
	});

	test('load filters saved quick register targets', () => {
		const stored: MemoryPreset[] = [
			{
				id: 'preset-pc',
				name: 'PC',
				target: '$pc',
				createdAt: 1,
			},
			{
				id: 'preset-stack',
				name: 'Stack base',
				target: '0x20000000',
				createdAt: 2,
			},
		];

		const service = new PresetService(createMockContext(stored));

		assert.deepStrictEqual(service.getUserPresets().map((preset) => preset.id), ['preset-stack']);
	});
});

function createMockContext(storedPresets: MemoryPreset[] = []): vscode.ExtensionContext {
	const storage = new Map<string, unknown>([['stackscope.presets', storedPresets]]);
	return {
		workspaceState: {
			get: <T>(key: string) => storage.get(key) as T | undefined,
			update: (key: string, value: unknown) => {
				storage.set(key, value);
				return Promise.resolve();
			},
		},
	} as unknown as vscode.ExtensionContext;
}
