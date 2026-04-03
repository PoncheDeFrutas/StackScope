import * as assert from 'assert';
import {
	captureBaselineFromPages,
	diffPagesAgainstBaseline,
	getChangedByteCount,
	getChangedCellOpacity,
	hasAnimatingChanges,
	MIN_CHANGED_CELL_OPACITY,
} from '../webview/changeTracking.js';

suite('Change Tracking', () => {
	test('captureBaselineFromPages flattens loaded page bytes by global offset', () => {
		const baseline = captureBaselineFromPages(
			new Map([
				[0, { data: [1, 2, null] }],
				[4, { data: [9] }],
			])
		);

		assert.strictEqual(baseline.get(0), 1);
		assert.strictEqual(baseline.get(1), 2);
		assert.strictEqual(baseline.get(2), null);
		assert.strictEqual(baseline.get(4), 9);
	});

	test('diffPagesAgainstBaseline only reports offsets that have known baseline and changed', () => {
		const baseline = new Map<number, number | null>([
			[0, 1],
			[1, 2],
			[2, 3],
		]);

		const changed = diffPagesAgainstBaseline(
			new Map([
				[0, { data: [1, 5, 3, 9] }],
			]),
			baseline,
			1234
		);

		assert.deepStrictEqual(Array.from(changed.entries()), [[1, 1234]]);
		assert.strictEqual(getChangedByteCount(changed), 1);
		assert.strictEqual(changed.has(3), false);
	});

	test('getChangedCellOpacity fades down to minimum opacity without disappearing', () => {
		const changedAt = 1000;

		assert.strictEqual(getChangedCellOpacity(changedAt, changedAt), 1);
		assert.strictEqual(getChangedCellOpacity(changedAt, changedAt + 999999), MIN_CHANGED_CELL_OPACITY);
	});

	test('hasAnimatingChanges stops once fade duration has elapsed', () => {
		const changes = new Map<number, number>([[10, 1000]]);

		assert.strictEqual(hasAnimatingChanges(changes, 1100, 500), true);
		assert.strictEqual(hasAnimatingChanges(changes, 1600, 500), false);
	});
});
