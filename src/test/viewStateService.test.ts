import * as assert from 'assert';
import type * as vscode from 'vscode';
import { DEFAULT_CONFIG } from '../domain/config/MemoryViewConfig.js';
import {
	mergeRegisterValueFormat,
	mergeMemoryViewState,
	sanitizeViewState,
	ViewStateService,
} from '../host/services/ViewStateService.js';

suite('ViewStateService', () => {
	test('sanitizeViewState returns null for non-object values', () => {
		assert.strictEqual(sanitizeViewState(null), null);
		assert.strictEqual(sanitizeViewState('invalid'), null);
	});

	test('sanitizeViewState preserves valid persisted fields', () => {
		const result = sanitizeViewState({
			currentTarget: '  $sp  ',
			config: {
				columns: 8,
				unitSize: 2,
				endianness: 'big',
				totalSize: 2048,
				numberFormat: 'dec',
				decodedMode: 'hidden',
			},
			showSettings: true,
			showRegisterPanel: false,
			registerPanelWidth: 420,
			registerValueFormat: 'bin',
		});

		assert.deepStrictEqual(result, {
			currentTarget: '$sp',
			config: {
				columns: 8,
				unitSize: 2,
				endianness: 'big',
				totalSize: 2048,
				numberFormat: 'dec',
				decodedMode: 'hidden',
			},
			showSettings: true,
			showRegisterPanel: false,
			registerPanelWidth: 420,
			registerValueFormat: 'bin',
		});
	});

	test('sanitizeViewState falls back to defaults for invalid fields', () => {
		const result = sanitizeViewState({
			currentTarget: 123,
			config: {
				columns: 3,
				unitSize: 3,
				endianness: 'sideways',
				totalSize: 10,
				numberFormat: 'base36',
				decodedMode: 'utf16',
			},
			showSettings: 'yes',
			showRegisterPanel: 'no',
			registerPanelWidth: Number.POSITIVE_INFINITY,
			registerValueFormat: 'signed-decimal',
		});

		assert.deepStrictEqual(result, {
			currentTarget: '',
			config: {
				...DEFAULT_CONFIG,
				totalSize: 256,
			},
			showSettings: false,
			showRegisterPanel: true,
			registerPanelWidth: 320,
			registerValueFormat: 'hex',
		});
	});

	test('mergeRegisterValueFormat changes only register format', () => {
		const current = sanitizeViewState({
			currentTarget: '$sp',
			config: DEFAULT_CONFIG,
			showSettings: true,
			showRegisterPanel: false,
			registerPanelWidth: 400,
			registerValueFormat: 'hex',
		});

		const result = mergeRegisterValueFormat(current, 'dec');

		assert.strictEqual(result.currentTarget, '$sp');
		assert.strictEqual(result.showSettings, true);
		assert.strictEqual(result.showRegisterPanel, false);
		assert.strictEqual(result.registerPanelWidth, 400);
		assert.strictEqual(result.registerValueFormat, 'dec');
	});

	test('mergeRegisterValueFormat initializes a complete default state', () => {
		const result = mergeRegisterValueFormat(null, 'invalid');

		assert.deepStrictEqual(result, {
			currentTarget: '',
			config: DEFAULT_CONFIG,
			showSettings: false,
			showRegisterPanel: true,
			registerPanelWidth: 320,
			registerValueFormat: 'hex',
		});
	});

	test('mergeMemoryViewState preserves register state from separate view', () => {
		const current = sanitizeViewState({
			currentTarget: '$sp',
			config: DEFAULT_CONFIG,
			showSettings: false,
			showRegisterPanel: false,
			registerPanelWidth: 400,
			registerValueFormat: 'dec',
		});
		const next = {
			currentTarget: '$pc',
			config: DEFAULT_CONFIG,
			showSettings: true,
		};

		const result = mergeMemoryViewState(current, next);

		assert.strictEqual(result.currentTarget, '$pc');
		assert.strictEqual(result.showSettings, true);
		assert.strictEqual(result.showRegisterPanel, false);
		assert.strictEqual(result.registerPanelWidth, 400);
		assert.strictEqual(result.registerValueFormat, 'dec');
	});

	test('serializes memory and register view updates', async () => {
		const storage = new Map<string, unknown>();
		let updates = 0;
		let releaseFirst: (() => void) | undefined;
		const firstUpdateStarted = new Promise<void>((resolve) => {
			const context = createMockContext(storage, async (key, value) => {
				updates += 1;
				if (updates === 1) {
					resolve();
					await new Promise<void>((release) => {
						releaseFirst = release;
					});
				}
				storage.set(key, value);
			});
			storage.set('context', context);
		});
		const context = storage.get('context') as vscode.ExtensionContext;
		const service = new ViewStateService(context);

		const memorySave = service.save({
			currentTarget: '$sp',
			config: DEFAULT_CONFIG,
			showSettings: true,
		});
		await firstUpdateStarted;
		const registerSave = service.saveRegisterViewState('dec');
		releaseFirst?.();
		await Promise.all([memorySave, registerSave]);

		assert.deepStrictEqual(service.get(), {
			currentTarget: '$sp',
			config: DEFAULT_CONFIG,
			showSettings: true,
			showRegisterPanel: true,
			registerPanelWidth: 320,
			registerValueFormat: 'dec',
		});
	});
});

function createMockContext(
	storage: Map<string, unknown>,
	update: (key: string, value: unknown) => Promise<void>
): vscode.ExtensionContext {
	return {
		workspaceState: {
			get: <T>(key: string) => storage.get(key) as T | undefined,
			update,
		},
	} as unknown as vscode.ExtensionContext;
}
