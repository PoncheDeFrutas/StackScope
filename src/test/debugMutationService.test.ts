import * as assert from 'assert';
import { DebugMutationService } from '../host/services/DebugMutationService.js';

suite('DebugMutationService', () => {
	test('serializes mutation and verification work for the same session', async () => {
		const service = new DebugMutationService();
		const calls: string[] = [];
		let releaseFirst: (() => void) | undefined;
		const firstReady = new Promise<void>((resolve) => { releaseFirst = resolve; });

		const first = service.run('session-1', async () => {
			calls.push('write:start');
			await firstReady;
			calls.push('verify:end');
			return 'first';
		});
		const second = service.run('session-1', async () => {
			calls.push('second');
			return 'second';
		});

		await Promise.resolve();
		assert.deepStrictEqual(calls, ['write:start']);
		releaseFirst?.();
		assert.deepStrictEqual(await Promise.all([first, second]), ['first', 'second']);
		assert.deepStrictEqual(calls, ['write:start', 'verify:end', 'second']);
	});
});
