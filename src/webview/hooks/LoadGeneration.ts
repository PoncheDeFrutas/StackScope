/** Identifies the latest async load and rejects stale responses. */
export class LoadGeneration {
	private value = 0;

	current(): number {
		return this.value;
	}

	advance(): number {
		this.value += 1;
		return this.value;
	}

	invalidate(): void {
		this.value += 1;
	}

	isCurrent(generation: number): boolean {
		return generation === this.value;
	}
}
