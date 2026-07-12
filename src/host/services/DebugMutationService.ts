import { SequentialTaskQueue } from '../../shared/SequentialTaskQueue.js';

/** Serializes debugger mutations per session, including their verification reads. */
export class DebugMutationService {
	private readonly queues = new Map<string, { queue: SequentialTaskQueue; pending: number }>();

	run<T>(sessionId: string, operation: () => PromiseLike<T>): Promise<T> {
		let entry = this.queues.get(sessionId);
		if (!entry) {
			entry = { queue: new SequentialTaskQueue(), pending: 0 };
			this.queues.set(sessionId, entry);
		}
		entry.pending += 1;
		return entry.queue.enqueue(operation).finally(() => {
			entry.pending -= 1;
			if (entry.pending === 0 && this.queues.get(sessionId) === entry) {
				this.queues.delete(sessionId);
			}
		});
	}
}
