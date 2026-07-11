import * as assert from 'assert';
import type * as vscode from 'vscode';
import { DapDebugGateway } from '../debug/dap/DapDebugGateway.js';

suite('DapDebugGateway', () => {
	test('limits concurrent register evaluations and preserves expression order', async () => {
		let active = 0;
		let peak = 0;
		const session = createSession(async (command, args) => {
			assert.strictEqual(command, 'evaluate');
			active += 1;
			peak = Math.max(peak, active);
			await new Promise<void>((resolve) => setTimeout(resolve, 1));
			active -= 1;
			return { result: `value:${args.expression}` };
		});
		const gateway = new DapDebugGateway({
			maxConcurrentRegisterEvaluations: 2,
			sessionResolver: () => session,
		});

		const results = await gateway.readRegisters('session-1', ['r0', 'r1', 'r2'], 42);

		assert.strictEqual(peak, 2);
		assert.deepStrictEqual(results, [
			{ expression: 'r0', value: 'value:$r0' },
			{ expression: 'r1', value: 'value:$r1' },
			{ expression: 'r2', value: 'value:$r2' },
		]);
	});

	test('limits concurrent stack traces and keeps thread order', async () => {
		let active = 0;
		let peak = 0;
		const session = createSession(async (command, args) => {
			if (command === 'threads') {
				return { threads: [{ id: 1 }, { id: 2 }, { id: 3 }] };
			}
			assert.strictEqual(command, 'stackTrace');
			active += 1;
			peak = Math.max(peak, active);
			await new Promise<void>((resolve) => setTimeout(resolve, 1));
			active -= 1;
			const threadId = args.threadId;
			if (typeof threadId !== 'number') {
				throw new Error('stackTrace requires a numeric threadId');
			}
			return { stackFrames: [{ id: threadId * 10, name: `frame-${threadId}` }] };
		});
		const gateway = new DapDebugGateway({
			maxConcurrentStackTraces: 2,
			sessionResolver: () => session,
		});

		const threads = await gateway.listCallStack('session-1');

		assert.strictEqual(peak, 2);
		assert.deepStrictEqual(threads.map((thread) => thread.id), [1, 2, 3]);
		assert.deepStrictEqual(
			threads.map((thread) => thread.frames[0]?.id),
			[10, 20, 30]
		);
	});

	test('returns per-expression session errors when no session resolves', async () => {
		const gateway = new DapDebugGateway({ sessionResolver: () => undefined });

		assert.deepStrictEqual(await gateway.readRegisters('missing', ['$pc', '$sp']), [
			{ expression: '$pc', value: null, error: 'No active session' },
			{ expression: '$sp', value: null, error: 'No active session' },
		]);
	});

	test('limits concurrent memory reads across calls', async () => {
		let active = 0;
		let peak = 0;
		const session = createSession(async (command) => {
			assert.strictEqual(command, 'readMemory');
			active += 1;
			peak = Math.max(peak, active);
			await new Promise<void>((resolve) => setTimeout(resolve, 1));
			active -= 1;
			return { address: '0x0', data: '' };
		});
		const gateway = new DapDebugGateway({
			maxConcurrentMemoryReads: 2,
			sessionResolver: () => session,
		});

		await Promise.all([0, 1, 2, 3].map((offset) =>
			gateway.readMemory('session-1', '0x0', offset, 1)
		));

		assert.strictEqual(peak, 2);
	});
});

function createSession(
	customRequest: (command: string, args: Record<string, unknown>) => Promise<unknown>
): vscode.DebugSession {
	return {
		id: 'session-1',
		customRequest: (command: string, args?: Record<string, unknown>) =>
			customRequest(command, args ?? {}),
	} as unknown as vscode.DebugSession;
}
