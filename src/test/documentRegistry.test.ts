import * as assert from 'assert';
import { DEFAULT_CONFIG } from '../domain/config/MemoryViewConfig.js';
import { createMemoryDocument } from '../domain/documents/MemoryDocument.js';
import { DocumentRegistry } from '../domain/documents/DocumentRegistry.js';

suite('DocumentRegistry', () => {
	test('stores multiple documents and switches active document', () => {
		const registry = new DocumentRegistry();
		const first = createMemoryDocument('doc-1', '$sp', 'session-1', '0x2000');
		const second = createMemoryDocument('doc-2', '$pc', 'session-1', '0x1000');

		registry.add(first);
		registry.add(second);
		registry.setActive(first.id);
		registry.setActive(second.id);

		assert.strictEqual(registry.getActive()?.id, second.id);
		assert.deepStrictEqual(registry.getAll().map((doc) => doc.id), ['doc-1', 'doc-2']);
	});

	test('updates document metadata without changing identity', () => {
		const registry = new DocumentRegistry();
		const doc = createMemoryDocument('doc-1', '$sp', 'session-1', '0x2000');
		const config = { ...DEFAULT_CONFIG, columns: 32 };

		registry.add(doc);
		const updated = registry.updateMetadata(doc.id, {
			displayName: 'Stack pointer',
			config,
		});

		assert.strictEqual(updated?.id, doc.id);
		assert.strictEqual(updated?.displayName, 'Stack pointer');
		assert.deepStrictEqual(updated?.config, config);
		assert.strictEqual(updated?.memoryReference, '0x2000');
	});

	test('finds existing document by session and normalized target', () => {
		const registry = new DocumentRegistry();
		const doc = createMemoryDocument('doc-1', '  $sp  ', 'session-1', '0x2000');

		registry.add(doc);

		assert.strictEqual(registry.findBySessionTarget('session-1', '$sp')?.id, doc.id);
		assert.strictEqual(registry.findBySessionTarget('session-2', '$sp'), undefined);
	});

	test('treats repeated internal whitespace as same target', () => {
		const registry = new DocumentRegistry();
		const doc = createMemoryDocument('doc-1', '&(myVar)', 'session-1', '0x2000');

		registry.add(doc);

		assert.strictEqual(registry.findBySessionTarget('session-1', '  &(myVar)  ')?.id, doc.id);
	});

	test('clears only documents from terminated session and clears active document', () => {
		const registry = new DocumentRegistry();
		const terminated = createMemoryDocument('doc-1', '$sp', 'session-1', '0x2000');
		const current = createMemoryDocument('doc-2', '$pc', 'session-2', '0x1000');

		registry.add(terminated);
		registry.add(current);
		registry.setActive(terminated.id);
		registry.clearSession('session-1');

		assert.strictEqual(registry.get(terminated.id), undefined);
		assert.strictEqual(registry.get(current.id)?.id, current.id);
		assert.strictEqual(registry.getActive(), null);
	});

	test('removing active document does not select another document implicitly', () => {
		const registry = new DocumentRegistry();
		const first = createMemoryDocument('doc-1', '$sp', 'session-1', '0x2000');
		const second = createMemoryDocument('doc-2', '$pc', 'session-1', '0x1000');

		registry.add(first);
		registry.add(second);
		registry.setActive(first.id);
		assert.strictEqual(registry.remove(first.id), true);

		assert.strictEqual(registry.getActive(), null);
		assert.strictEqual(registry.get(second.id)?.id, second.id);
	});
});
