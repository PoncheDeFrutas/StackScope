import * as assert from 'assert';
import { MemoryLoadGeneration } from '../webview/hooks/MemoryLoadGeneration.js';

suite('MemoryLoadGeneration', () => {
	test('starts at current generation and advances batches', () => {
		const generation = new MemoryLoadGeneration();

		assert.strictEqual(generation.current(), 0);
		assert.strictEqual(generation.advance(), 1);
		assert.strictEqual(generation.current(), 1);
	});

	test('rejects responses from older generation', () => {
		const generation = new MemoryLoadGeneration();
		const first = generation.advance();
		const second = generation.advance();

		assert.strictEqual(generation.isCurrent(first), false);
		assert.strictEqual(generation.isCurrent(second), true);
	});
});
