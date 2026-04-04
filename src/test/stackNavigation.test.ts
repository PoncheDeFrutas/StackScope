import * as assert from 'assert';
import { resolveRequestedFrame, toInstructionSnapshots } from '../host/bridge/stackNavigation.js';
import type { StackThreadSnapshot } from '../protocol/methods.js';

suite('stackNavigation', () => {
	test('resolves frame by index when ids are stale', () => {
		const threads: StackThreadSnapshot[] = [
			{
				id: 1,
				name: 'Thread 1',
				frames: [
					{
						id: 1003,
						threadId: 1,
						name: '_start',
						sourcePath: '/tmp/main.s',
						line: 49,
						column: 1,
						instructionPointerReference: '0x1000',
					},
					{
						id: 1004,
						threadId: 1,
						name: 'main',
						sourcePath: '/tmp/main.s',
						line: 73,
						column: 1,
						instructionPointerReference: '0x1020',
					},
				],
			},
		];

		const resolved = resolveRequestedFrame(threads, {
			threadId: 1,
			frameId: 9999,
			frameIndex: 0,
			frameName: '_start',
			sourcePath: '/tmp/main.s',
			line: 49,
			column: 1,
		});

		assert.strictEqual(resolved?.id, 1003);
	});

	test('marks the current instruction by address match', () => {
		const snapshots = toInstructionSnapshots(
			[
				{ address: '0x1000', instruction: 'push {lr}' },
				{ address: '0x1004', instruction: 'mov r0, r1' },
			],
			'0x1004'
		);

		assert.strictEqual(snapshots[0]?.isCurrent, false);
		assert.strictEqual(snapshots[1]?.isCurrent, true);
	});

	test('falls back to the middle instruction when address is unavailable', () => {
		const snapshots = toInstructionSnapshots(
			[
				{ address: '0x1000', instruction: 'a' },
				{ address: '0x1004', instruction: 'b' },
				{ address: '0x1008', instruction: 'c' },
			],
			'invalid'
		);

		assert.deepStrictEqual(
			snapshots.map((instruction) => instruction.isCurrent),
			[false, true, false]
		);
	});
});
