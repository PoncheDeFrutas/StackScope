import * as assert from 'assert';
import type * as vscode from 'vscode';
import { DapCapabilitiesService } from '../debug/dap/DapCapabilitiesService.js';

suite('DapCapabilitiesService', () => {
	test('publishes write support after initialize capabilities arrive', () => {
		const service = new DapCapabilitiesService();
		const changes: string[] = [];
		const subscription = service.onDidChange((sessionId) => changes.push(sessionId));
		const tracker = service.createDebugAdapterTracker({ id: 'session-1', type: 'mock' } as vscode.DebugSession);

		tracker.onWillReceiveMessage?.({ type: 'request', seq: 1, command: 'initialize' });
		tracker.onDidSendMessage?.({
			type: 'response',
			request_seq: 1,
			success: true,
			body: { supportsWriteMemoryRequest: true, supportsSetExpression: false },
		});

		assert.deepStrictEqual(service.getWriteSupport('session-1'), { memory: true, register: false });
		assert.deepStrictEqual(changes, ['session-1', 'session-1']);
		subscription.dispose();
		service.dispose();
	});

	test('enables both writes for a supported GDB fallback adapter', () => {
		const service = new DapCapabilitiesService();
		service.createDebugAdapterTracker({ id: 'session-1', type: 'cppdbg', configuration: { MIMode: 'gdb' } } as unknown as vscode.DebugSession);
		assert.deepStrictEqual(service.getWriteSupport('session-1'), { memory: true, register: true });
		service.dispose();
	});

	test('does not enable GDB fallback for an LLDB cppdbg session', () => {
		const service = new DapCapabilitiesService();
		service.createDebugAdapterTracker({ id: 'session-1', type: 'cppdbg', configuration: { MIMode: 'lldb' } } as unknown as vscode.DebugSession);
		assert.deepStrictEqual(service.getWriteSupport('session-1'), { memory: false, register: false });
		service.dispose();
	});

	test('publishes data breakpoint and range support', () => {
		const service = new DapCapabilitiesService();
		const tracker = service.createDebugAdapterTracker({ id: 'session-1', type: 'mock' } as vscode.DebugSession);
		tracker.onWillReceiveMessage?.({ type: 'request', seq: 1, command: 'initialize' });
		tracker.onDidSendMessage?.({
			type: 'response', request_seq: 1, success: true,
			body: { supportsDataBreakpoints: true, supportsDataBreakpointBytes: true },
		});
		assert.deepStrictEqual(service.getDataBreakpointSupport('session-1'), { dataBreakpoints: true, memoryRanges: true, gdbRegisterFallback: false });
		service.dispose();
	});
});
