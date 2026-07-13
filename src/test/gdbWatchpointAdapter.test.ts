import * as assert from 'assert';
import type * as vscode from 'vscode';
import { createGdbWatchpoint, parseGdbWatchpointId } from '../debug/dap/GdbWatchpointAdapter.js';

suite('GdbWatchpointAdapter', () => {
	test('parses hardware, software, read, and access watchpoint output', () => {
		assert.strictEqual(parseGdbWatchpointId('Hardware watchpoint 3: $x0'), 3);
		assert.strictEqual(parseGdbWatchpointId('Hardware read watchpoint 4: $x1'), 4);
		assert.strictEqual(parseGdbWatchpointId('Hardware access watchpoint 5: $x2'), 5);
		assert.strictEqual(parseGdbWatchpointId('GDB rejected command'), null);
	});

	test('does not send unsafe register expressions to GDB', async () => {
		const session = { customRequest: async () => { throw new Error('must not execute'); } } as unknown as vscode.DebugSession;
		assert.deepStrictEqual(await createGdbWatchpoint(session, '$x0; continue', 'write'), {
			breakpointId: null, verified: false, message: 'GDB fallback only accepts a single register expression.',
		});
	});
});
