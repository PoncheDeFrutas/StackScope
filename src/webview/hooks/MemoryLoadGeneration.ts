/**
 * Identifies current memory-load batch and rejects responses from older batches.
 */
export class MemoryLoadGeneration {
	private value = 0;

	current(): number {
		return this.value;
	}

	advance(): number {
		this.value += 1;
		return this.value;
	}

	isCurrent(generation: number): boolean {
		return generation === this.value;
	}
}
