import * as assert from 'assert';
import type * as vscode from 'vscode';
import type { RegisterSet } from '../domain/registers/RegisterSet.js';
import { RegisterSetService } from '../host/services/RegisterSetService.js';

suite('RegisterSetService', () => {
	test('filters persisted builtin sets and restores a valid user selection', () => {
		const stored: RegisterSet[] = [
			{
				id: 'builtin-injected',
				name: 'Injected builtin',
				registers: [],
				createdAt: 1,
			},
			{
				id: 'saved-registers',
				name: 'Saved registers',
				registers: [{ expression: '$x0', label: 'x0' }],
				createdAt: 2,
			},
		];
		const service = new RegisterSetService(
			createMockContext(stored, 'saved-registers')
		);

		assert.deepStrictEqual(service.getAll().map((set) => set.id), ['builtin-core', 'saved-registers']);
		assert.strictEqual(service.getSelectedId(), 'saved-registers');
	});

	test('persists selection and falls back to core when deleting selected user set', async () => {
		const storage = createStorage();
		const service = new RegisterSetService(createMockContext([], undefined, storage));
		const created = service.save('ARM', [{ expression: '$r0', label: 'r0' }]);

		assert.strictEqual(service.select(created.id), true);
		await flushPersistenceQueue();
		assert.strictEqual(storage.values.get('stackscope.selectedRegisterSet'), created.id);
		assert.strictEqual(service.delete(created.id), true);
		await flushPersistenceQueue();
		assert.strictEqual(service.getSelectedId(), 'builtin-core');
		assert.strictEqual(storage.values.get('stackscope.selectedRegisterSet'), 'builtin-core');
		assert.deepStrictEqual(storage.values.get('stackscope.registerSets'), []);
	});

	test('preserves identity and creation timestamp when updating a user set', () => {
		const service = new RegisterSetService(createMockContext());
		const created = service.save('Core', [{ expression: '$pc' }]);
		const updated = service.update(created.id, {
			name: 'Core updated',
			registers: [{ expression: '$sp', label: 'SP' }],
		});

		assert.ok(updated);
		assert.strictEqual(updated.id, created.id);
		assert.strictEqual(updated.createdAt, created.createdAt);
		assert.deepStrictEqual(updated.registers, [{ expression: '$sp', label: 'SP' }]);
	});
});

interface MockStorage {
	values: Map<string, unknown>;
}

async function flushPersistenceQueue(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
}

function createStorage(): MockStorage {
	return { values: new Map() };
}

function createMockContext(
	storedSets: RegisterSet[] = [],
	selectedSetId?: string,
	storage: MockStorage = createStorage()
): vscode.ExtensionContext {
	storage.values.set('stackscope.registerSets', storedSets);
	if (selectedSetId) {
		storage.values.set('stackscope.selectedRegisterSet', selectedSetId);
	}

	return {
		workspaceState: {
			get: <T>(key: string) => storage.values.get(key) as T | undefined,
			update: (key: string, value: unknown) => {
				storage.values.set(key, value);
				return Promise.resolve();
			},
		},
	} as unknown as vscode.ExtensionContext;
}
