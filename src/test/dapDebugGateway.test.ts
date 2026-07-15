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
		const gateway = new DapDebugGateway(undefined, () => session);

		const results = await gateway.readRegisters('session-1', ['r0', 'r1', 'r2', 'r3', 'r4'], 42);

		assert.strictEqual(peak, 4);
		assert.deepStrictEqual(results, [
			{ expression: 'r0', value: 'value:$r0' },
			{ expression: 'r1', value: 'value:$r1' },
			{ expression: 'r2', value: 'value:$r2' },
			{ expression: 'r3', value: 'value:$r3' },
			{ expression: 'r4', value: 'value:$r4' },
		]);
	});

	test('limits concurrent stack traces and keeps thread order', async () => {
		let active = 0;
		let peak = 0;
		const session = createSession(async (command, args) => {
			if (command === 'threads') {
				return { threads: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }] };
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
		const gateway = new DapDebugGateway(undefined, () => session);

		const threads = await gateway.listCallStack('session-1');

		assert.strictEqual(peak, 4);
		assert.deepStrictEqual(threads.map((thread) => thread.id), [1, 2, 3, 4, 5]);
		assert.deepStrictEqual(
			threads.map((thread) => thread.frames[0]?.id),
			[10, 20, 30, 40, 50]
		);
	});

	test('returns per-expression session errors when no session resolves', async () => {
		const gateway = new DapDebugGateway(undefined, () => undefined);

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
		const gateway = new DapDebugGateway(undefined, () => session);

		await Promise.all([0, 1, 2, 3, 4].map((offset) =>
			gateway.readMemory('session-1', '0x0', offset, 1)
		));

		assert.strictEqual(peak, 4);
	});

	test('uses GDB evaluate fallback for memory writes when DAP writeMemory is unavailable', async () => {
		const expressions: string[] = [];
		const session = createSession(async (command, args) => {
			assert.strictEqual(command, 'evaluate');
			expressions.push(String(args.expression));
			return { result: '1' };
		});
		const gateway = new DapDebugGateway(gdbFallbackCapabilities(), () => session);

		const result = await gateway.writeMemory('session-1', '0x1000', 1, [0xaa, 0xbb], true);

		assert.deepStrictEqual(result, { offset: 1, bytesWritten: 2 });
		assert.deepStrictEqual(expressions, [
			'*(unsigned char *)0x1001 = 0xaa',
			'*(unsigned char *)0x1002 = 0xbb',
		]);
	});

	test('uses GDB evaluate fallback for register writes', async () => {
		const session = createSession(async (command, args) => {
			assert.strictEqual(command, 'evaluate');
			assert.strictEqual(args.expression, '$x0 = 0x42');
			return { result: '0x42' };
		});
		const gateway = new DapDebugGateway(gdbFallbackCapabilities(), () => session);

		assert.deepStrictEqual(await gateway.setExpression('session-1', 'x0', '0x42'), { value: '0x42' });
	});

	test('falls back to GDB set command when C assignment fails', async () => {
		const expressions: string[] = [];
		const contexts: unknown[] = [];
		const session = createSession(async (_command, args) => {
			const expression = String(args.expression);
			expressions.push(expression);
			contexts.push(args.context);
			assert.strictEqual('frameId' in args, false);
			if (expression.startsWith('*(')) {
				throw new Error('C expression rejected');
			}
			return { result: '' };
		});
		const gateway = new DapDebugGateway(gdbFallbackCapabilities(), () => session);

		assert.deepStrictEqual(await gateway.writeMemory('session-1', '0x2000', 0, [0x49], true), {
			offset: 0,
			bytesWritten: 1,
		});
		assert.deepStrictEqual(expressions, [
			'*(unsigned char *)0x2000 = 0x49',
			'-exec set {unsigned char}0x2000 = 0x49',
		]);
		assert.deepStrictEqual(contexts, ['repl', 'repl']);
	});

	test('gets data breakpoint info and applies data breakpoints', async () => {
		const session = createSession(async (command, args) => {
			if (command === 'dataBreakpointInfo') {
				assert.deepStrictEqual(args, { name: '$pc', frameId: 7 });
				return { dataId: 'pc-id', description: 'Program counter', accessTypes: ['read', 'write'] };
			}
			assert.strictEqual(command, 'setDataBreakpoints');
			assert.deepStrictEqual(args, { breakpoints: [{ dataId: 'pc-id', accessType: 'write' }] });
			return { breakpoints: [{ id: 4, verified: true }] };
		});
		const capabilities = {
			supportsDataBreakpoints: () => true,
		} as never;
		const gateway = new DapDebugGateway(capabilities, () => session);
		assert.deepStrictEqual(await gateway.getDataBreakpointInfo('session-1', { name: '$pc', frameId: 7 }), {
			dataId: 'pc-id', description: 'Program counter', accessTypes: ['read', 'write'],
		});
		assert.deepStrictEqual(await gateway.setDataBreakpoints('session-1', [{ dataId: 'pc-id', accessType: 'write' }]), [{ id: 4, verified: true, message: undefined }]);
	});

	test('creates and removes GDB register watchpoints without DAP support', async () => {
		const requests: Array<{ expression: string; context: unknown }> = [];
		const session = createSession(async (command, args) => {
			assert.strictEqual(command, 'evaluate');
			requests.push({ expression: String(args.expression), context: args.context });
			return { result: args.expression === '-exec awatch $rax' ? 'Hardware access watchpoint 7: $rax' : '' };
		});
		const gateway = new DapDebugGateway(gdbFallbackCapabilities(), () => session);

		assert.deepStrictEqual(await gateway.createGdbWatchpoint('session-1', 'rax', 'readWrite'), {
			breakpointId: 7, verified: true, message: 'Hardware access watchpoint 7: $rax',
		});
		assert.deepStrictEqual(await gateway.removeGdbWatchpoint('session-1', 7), { breakpointId: 7, verified: true });
		assert.deepStrictEqual(requests, [
			{ expression: '-exec awatch $rax', context: 'repl' },
			{ expression: '-exec delete 7', context: 'repl' },
		]);
	});

	test('rejects unsafe GDB fallback expressions before sending a command', async () => {
		const session = createSession(async () => {
			throw new Error('must not be called');
		});
		const gateway = new DapDebugGateway(gdbFallbackCapabilities(), () => session);

		assert.deepStrictEqual(await gateway.createGdbWatchpoint('session-1', '$rax; continue', 'write'), {
			breakpointId: null, verified: false, message: 'GDB fallback only accepts a single register expression.',
		});
	});
});

function gdbFallbackCapabilities() {
	return {
		supportsWriteMemory: () => false,
		supportsSetExpression: () => false,
		supportsGdbFallback: () => true,
	} as never;
}

function createSession(
	customRequest: (command: string, args: Record<string, unknown>) => Promise<unknown>
): vscode.DebugSession {
	return {
		id: 'session-1',
		customRequest: (command: string, args?: Record<string, unknown>) =>
			customRequest(command, args ?? {}),
	} as unknown as vscode.DebugSession;
}
