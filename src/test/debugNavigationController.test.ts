import * as assert from 'assert';
import type { DebugGateway } from '../debug/contracts/DebugGateway.js';
import type { SessionState, SessionTracker } from '../debug/contracts/SessionTracker.js';
import { DebugNavigationController } from '../host/bridge/DebugNavigationController.js';
import { StackSelectionService } from '../host/services/StackSelectionService.js';
import type { EventMap, EventName } from '../protocol/events.js';

suite('DebugNavigationController', () => {
	test('selects a frame and emits updated call stack and disassembly snapshots', async () => {
		const events: Array<{ event: EventName; payload: unknown }> = [];
		const controller = new DebugNavigationController(
			createSessionTracker({ sessionId: 'session-1', status: 'stopped' }),
			createDebugGateway(),
			new StackSelectionService(),
			(event, payload) => events.push({ event, payload })
		);

		const initial = await controller.getCallStackSnapshot();
		assert.deepStrictEqual(initial.selection, { threadId: 7, frameId: 70 });

		const result = await controller.selectStackFrame({
			threadId: 7,
			frameId: 71,
			frameIndex: 1,
		});

		assert.deepStrictEqual(result, {
			success: true,
			selection: { threadId: 7, frameId: 71 },
		});
		assert.deepStrictEqual(events.map((event) => event.event), [
			'callStackChanged',
			'disassemblyChanged',
		]);
		const disassembly = events[1].payload as EventMap['disassemblyChanged'];
		assert.strictEqual(disassembly.frame?.id, 71);
		assert.strictEqual(disassembly.instructions[0]?.isCurrent, true);
	});
});

function createSessionTracker(state: SessionState): SessionTracker {
	return {
		getState: () => state,
		refresh: async () => state,
		onStateChanged: () => () => undefined,
		dispose: () => undefined,
	};
}

function createDebugGateway(): DebugGateway {
	return {
		readMemory: async () => null,
		evaluateForMemoryReference: async () => null,
		readRegisters: async () => [],
		listCallStack: async () => [{
			id: 7,
			name: 'Main thread',
			frames: [
				{ id: 70, threadId: 7, name: 'main', instructionPointerReference: '0x1000' },
				{ id: 71, threadId: 7, name: 'worker', instructionPointerReference: '0x1010' },
			],
		}],
		readDisassembly: async (_sessionId, reference) => ({
			instructions: [{ address: reference, instruction: 'nop' }],
		}),
	};
}
