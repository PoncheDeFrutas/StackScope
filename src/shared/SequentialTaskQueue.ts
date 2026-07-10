/**
 * Serializes asynchronous work while allowing later tasks after a failure.
 */
export class SequentialTaskQueue {
	private pending: Promise<void> = Promise.resolve();

	enqueue(task: () => PromiseLike<void>): Promise<void> {
		const operation = this.pending.then(task);
		this.pending = operation.catch(() => undefined);
		return operation;
	}
}
