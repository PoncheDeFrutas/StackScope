/**
 * Maps items with a bounded number of in-flight operations while preserving order.
 */
export async function mapWithConcurrency<T, R>(
	items: readonly T[],
	limit: number,
	map: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	if (!Number.isInteger(limit) || limit < 1) {
		throw new RangeError('Concurrency limit must be a positive integer');
	}

	const results = new Array<R>(items.length);
	let nextIndex = 0;
	const workerCount = Math.min(limit, items.length);

	const worker = async (): Promise<void> => {
		while (nextIndex < items.length) {
			const index = nextIndex;
			nextIndex += 1;
			results[index] = await map(items[index], index);
		}
	};

	await Promise.all(Array.from({ length: workerCount }, worker));
	return results;
}

/** Limits all operations submitted through one instance. */
export class ConcurrencyLimiter {
	private active = 0;
	private readonly waiting: Array<() => void> = [];

	constructor(private readonly limit: number) {
		if (!Number.isInteger(limit) || limit < 1) {
			throw new RangeError('Concurrency limit must be a positive integer');
		}
	}

	async run<T>(operation: () => Promise<T>): Promise<T> {
		await this.acquire();
		try {
			return await operation();
		} finally {
			this.release();
		}
	}

	private async acquire(): Promise<void> {
		if (this.active < this.limit) {
			this.active += 1;
			return;
		}
		await new Promise<void>((resolve) => this.waiting.push(resolve));
	}

	private release(): void {
		const next = this.waiting.shift();
		if (next) {
			next();
			return;
		}
		this.active -= 1;
	}
}
