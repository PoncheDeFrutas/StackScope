import * as vscode from 'vscode';
import type {
	SessionTracker,
	SessionState,
	SessionStatus,
	SessionStateListener,
} from '../contracts/SessionTracker.js';

/**
 * VS Code implementation of SessionTracker.
 * Tracks debug session lifecycle via VS Code debug API.
 */
export class VscodeSessionTracker implements SessionTracker {
	private state: SessionState = { sessionId: null, status: 'none' };
	private readonly listeners = new Set<SessionStateListener>();
	private readonly disposables: vscode.Disposable[] = [];

	constructor() {
		// Track session start
		this.disposables.push(
			vscode.debug.onDidStartDebugSession((session) => {
				this.updateState({ sessionId: session.id, status: 'running' });
			})
		);

		// Track session end
		this.disposables.push(
			vscode.debug.onDidTerminateDebugSession((session) => {
				if (this.state.sessionId === session.id) {
					this.updateState({ sessionId: null, status: 'none' });
				}
			})
		);

		// Track stopped/continued events via custom event
		// Note: Not all adapters emit these as custom events
		this.disposables.push(
			vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
				if (this.state.sessionId !== event.session.id) {
					return;
				}
				if (event.event === 'stopped') {
					this.updateState({ ...this.state, status: 'stopped' });
				} else if (event.event === 'continued') {
					this.updateState({ ...this.state, status: 'running' });
				}
			})
		);

		// Track active stack item changes - this fires when stopped at breakpoint
		this.disposables.push(
			vscode.debug.onDidChangeActiveStackItem(() => {
				// If we have a stack item, the session is stopped
				if (vscode.debug.activeStackItem && this.state.sessionId) {
					this.updateState({ ...this.state, status: 'stopped' });
				}
			})
		);

		// Also listen to active debug session changes
		this.disposables.push(
			vscode.debug.onDidChangeActiveDebugSession((session) => {
				if (session) {
					// When switching sessions, probe actual state
					this.probeSessionState(session);
				} else if (!vscode.debug.activeDebugSession) {
					this.updateState({ sessionId: null, status: 'none' });
				}
			})
		);

		// Initialize from current state
		const activeSession = vscode.debug.activeDebugSession;
		if (activeSession) {
			this.state = { sessionId: activeSession.id, status: 'running' };
			// Probe actual state
			this.probeSessionState(activeSession);
		}
	}

	/**
	 * Probes the actual state of a debug session by checking threads.
	 */
	private async probeSessionState(session: vscode.DebugSession): Promise<void> {
		try {
			// Request threads - if any thread is stopped, session is stopped
			const response = await session.customRequest('threads');
			if (response && Array.isArray(response.threads)) {
				// Check if we have an active stack item (indicates stopped)
				if (vscode.debug.activeStackItem) {
					this.updateState({ sessionId: session.id, status: 'stopped' });
					return;
				}

				// Try to get stack trace for first thread to see if stopped
				if (response.threads.length > 0) {
					try {
						const stackResponse = await session.customRequest('stackTrace', {
							threadId: response.threads[0].id,
							startFrame: 0,
							levels: 1,
						});
						if (stackResponse && stackResponse.stackFrames?.length > 0) {
							this.updateState({ sessionId: session.id, status: 'stopped' });
							return;
						}
					} catch {
						// Stack trace failed - likely running
					}
				}
			}
			this.updateState({ sessionId: session.id, status: 'running' });
		} catch {
			// If threads request fails, assume running
			this.updateState({ sessionId: session.id, status: 'running' });
		}
	}

	/**
	 * Refreshes the current session state by probing the debugger.
	 */
	async refresh(): Promise<SessionState> {
		const session = vscode.debug.activeDebugSession;
		if (session && this.state.sessionId === session.id) {
			await this.probeSessionState(session);
		}
		return this.state;
	}

	private updateState(newState: SessionState): void {
		const changed =
			this.state.sessionId !== newState.sessionId ||
			this.state.status !== newState.status;

		if (changed) {
			this.state = newState;
			for (const listener of this.listeners) {
				listener(this.state);
			}
		}
	}

	getState(): SessionState {
		return this.state;
	}

	onStateChanged(listener: SessionStateListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Forces a status update (useful when we detect stopped state externally).
	 */
	forceStatus(status: SessionStatus): void {
		if (this.state.sessionId) {
			this.updateState({ ...this.state, status });
		}
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
		this.disposables.length = 0;
		this.listeners.clear();
	}
}
