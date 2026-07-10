import * as assert from 'assert';
import { SequentialTaskQueue } from '../shared/SequentialTaskQueue.js';

suite('SequentialTaskQueue', () => {
	test('runs tasks in insertion order', async () => {
		const queue = new SequentialTaskQueue();
		const calls: string[] = [];
		let releaseFirst: (() => void) | undefined;
		const firstReady = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		const first = queue.enqueue(async () => {
			calls.push('first:start');
			await firstReady;
			calls.push('first:end');
		});
		const second = queue.enqueue(async () => {
			calls.push('second');
		});

		await Promise.resolve();
		assert.deepStrictEqual(calls, ['first:start']);
		releaseFirst?.();
		await Promise.all([first, second]);
		assert.deepStrictEqual(calls, ['first:start', 'first:end', 'second']);
	});

	test('continues after a failed task', async () => {
		const queue = new SequentialTaskQueue();
		const calls: string[] = [];

		await assert.rejects(
			() => queue.enqueue(async () => {
				throw new Error('write failed');
			})
		);
		await queue.enqueue(async () => {
			calls.push('recovered');
		});

		assert.deepStrictEqual(calls, ['recovered']);
	});
});
