export interface MemoryPageDataLike {
	data: (number | null)[];
}

export type ByteChangeMap = Map<number, number>;

export const CHANGE_HIGHLIGHT_FADE_MS = 2400;
export const MIN_CHANGED_CELL_OPACITY = 0.68;

export function captureBaselineFromPages(
	pages: Iterable<[number, MemoryPageDataLike]>
): Map<number, number | null> {
	const baseline = new Map<number, number | null>();

	for (const [offset, page] of pages) {
		page.data.forEach((byte, index) => {
			baseline.set(offset + index, byte);
		});
	}

	return baseline;
}

export function diffPagesAgainstBaseline(
	pages: Iterable<[number, MemoryPageDataLike]>,
	baseline: ReadonlyMap<number, number | null>,
	changedAt: number
): ByteChangeMap {
	const changed = new Map<number, number>();

	for (const [offset, page] of pages) {
		page.data.forEach((byte, index) => {
			const globalOffset = offset + index;
			if (!baseline.has(globalOffset)) {
				return;
			}
			if (baseline.get(globalOffset) !== byte) {
				changed.set(globalOffset, changedAt);
			}
		});
	}

	return changed;
}

export function getChangedByteCount(changes: ReadonlyMap<number, number>): number {
	return changes.size;
}

export function getChangedCellOpacity(
	changedAt: number,
	now: number,
	fadeDurationMs: number = CHANGE_HIGHLIGHT_FADE_MS
): number {
	const elapsed = Math.max(0, now - changedAt);
	const progress = Math.min(1, elapsed / fadeDurationMs);
	return 1 - (1 - MIN_CHANGED_CELL_OPACITY) * progress;
}

export function hasAnimatingChanges(
	changes: ReadonlyMap<number, number>,
	now: number,
	fadeDurationMs: number = CHANGE_HIGHLIGHT_FADE_MS
): boolean {
	for (const changedAt of changes.values()) {
		if (now - changedAt < fadeDurationMs) {
			return true;
		}
	}
	return false;
}
