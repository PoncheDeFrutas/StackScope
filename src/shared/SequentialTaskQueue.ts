/**
 * Serializes asynchronous work while allowing later tasks after a failure.
 */
export class SequentialTaskQueue {
	private pending: Promise<void> = Promise.resolve();

	enqueue<T>(task: () => PromiseLike<T>): Promise<T> {
		const operation = this.pending.then(task);
		this.pending = operation.then(() => undefined, () => undefined);
		return operation;
	}
}
