import * as assert from 'assert';
import { ConcurrencyLimiter, mapWithConcurrency } from '../shared/mapWithConcurrency.js';

suite('mapWithConcurrency', () => {
	test('preserves input order while limiting concurrent work', async () => {
		let active = 0;
		let peak = 0;
		const results = await mapWithConcurrency([3, 1, 2, 0], 2, async (value) => {
			active += 1;
			peak = Math.max(peak, active);
			await new Promise<void>((resolve) => setTimeout(resolve, value));
			active -= 1;
			return value * 10;
		});

		assert.strictEqual(peak, 2);
		assert.deepStrictEqual(results, [30, 10, 20, 0]);
	});

	test('rejects invalid concurrency limits', async () => {
		await assert.rejects(() => mapWithConcurrency([1], 0, async (value) => value));
	});

	test('limits independent submitted operations', async () => {
		let active = 0;
		let peak = 0;
		const limiter = new ConcurrencyLimiter(2);

		await Promise.all(Array.from({ length: 5 }, () => limiter.run(async () => {
			active += 1;
			peak = Math.max(peak, active);
			await new Promise<void>((resolve) => setTimeout(resolve, 1));
			active -= 1;
		})));

		assert.strictEqual(peak, 2);
	});
});
