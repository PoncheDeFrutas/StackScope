/**
 * Debug session status.
 */
export type SessionStatus = 'none' | 'running' | 'stopped';

/**
 * Session state snapshot.
 */
export interface SessionState {
	sessionId: string | null;
	status: SessionStatus;
}

/**
 * Listener for session state changes.
 */
export type SessionStateListener = (state: SessionState) => void;

/**
 * Abstract contract for tracking debug session lifecycle.
 */
export interface SessionTracker {
	/**
	 * Gets the current session state (cached).
	 */
	getState(): SessionState;

	/**
	 * Refreshes and returns the current session state by probing the debugger.
	 */
	refresh(): Promise<SessionState>;

	/**
	 * Registers a listener for session state changes.
	 * @returns A function to unregister the listener.
	 */
	onStateChanged(listener: SessionStateListener): () => void;

	/**
	 * Disposes the tracker and cleans up resources.
	 */
	dispose(): void;
}
