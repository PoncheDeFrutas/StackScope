export interface StackSelectionState {
	sessionId: string | null;
	threadId: number | null;
	frameId: number | null;
}

/**
 * Stores the frame/thread selection that StackScope uses as debugger context.
 * This selection is runtime-only and intentionally independent from VS Code's native UI.
 */
export class StackSelectionService {
	private selection: StackSelectionState = {
		sessionId: null,
		threadId: null,
		frameId: null,
	};

	get(): StackSelectionState {
		return { ...this.selection };
	}

	set(sessionId: string, threadId: number, frameId: number): void {
		this.selection = { sessionId, threadId, frameId };
	}

	clear(): void {
		this.selection = { sessionId: null, threadId: null, frameId: null };
	}

	clearIfSessionChanged(sessionId: string | null): void {
		if (this.selection.sessionId !== sessionId) {
			this.clear();
		}
	}
}
