import * as assert from 'assert';
import { RegisterLoadGeneration } from '../webview/hooks/RegisterLoadGeneration.js';

suite('RegisterLoadGeneration', () => {
	test('accepts only the latest refresh', () => {
		const generation = new RegisterLoadGeneration();
		const first = generation.begin();
		const second = generation.begin();

		assert.strictEqual(generation.isCurrent(first), false);
		assert.strictEqual(generation.isCurrent(second), true);
	});

	test('invalidates in-flight refreshes when context changes', () => {
		const generation = new RegisterLoadGeneration();
		const pending = generation.begin();
		generation.invalidate();

		assert.strictEqual(generation.isCurrent(pending), false);
	});
});
