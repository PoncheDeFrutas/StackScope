import * as assert from 'assert';
import { LoadGeneration } from '../webview/hooks/LoadGeneration.js';

suite('LoadGeneration', () => {
	test('starts at current generation and advances batches', () => {
		const generation = new LoadGeneration();

		assert.strictEqual(generation.current(), 0);
		assert.strictEqual(generation.advance(), 1);
		assert.strictEqual(generation.current(), 1);
	});

	test('rejects responses from older generation', () => {
		const generation = new LoadGeneration();
		const first = generation.advance();
		const second = generation.advance();

		assert.strictEqual(generation.isCurrent(first), false);
		assert.strictEqual(generation.isCurrent(second), true);
	});

	test('invalidates in-flight refreshes', () => {
		const generation = new LoadGeneration();
		const pending = generation.advance();
		generation.invalidate();

		assert.strictEqual(generation.isCurrent(pending), false);
	});
});
