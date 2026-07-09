export interface SessionProbe {
	sessionId: string;
	revision: number;
}

/**
 * Prevents a stale asynchronous session probe from replacing newer session state.
 */
export class SessionProbeGuard {
	private revision = 0;

	begin(sessionId: string): SessionProbe {
		this.revision += 1;
		return { sessionId, revision: this.revision };
	}

	invalidate(): void {
		this.revision += 1;
	}

	accepts(probe: SessionProbe, activeSessionId: string | undefined): boolean {
		return probe.revision === this.revision && probe.sessionId === activeSessionId;
	}
}
