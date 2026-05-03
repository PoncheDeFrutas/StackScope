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
});
