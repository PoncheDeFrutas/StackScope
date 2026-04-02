import { useState, useEffect, useCallback } from 'react';
import { HostClient } from './rpc/HostClient.js';
import { messageBus } from './rpc/WebviewMessageBus.js';
import { MemoryGrid } from './components/MemoryGrid.js';
import { StatusBar } from './components/StatusBar.js';
import { Toolbar } from './components/Toolbar.js';
import type { SessionSnapshot, DocumentSnapshot } from '../protocol/methods.js';

type AppState =
	| { phase: 'loading' }
	| { phase: 'no-session' }
	| { phase: 'no-document'; session: SessionSnapshot }
	| { phase: 'opening-document'; session: SessionSnapshot }
	| { phase: 'loading-memory'; session: SessionSnapshot; document: DocumentSnapshot }
	| {
			phase: 'ready';
			session: SessionSnapshot;
			document: DocumentSnapshot;
			memory: { address: string; data: number[] };
	  }
	| { phase: 'error'; session: SessionSnapshot; document: DocumentSnapshot | null; error: string };

const INITIAL_BYTE_COUNT = 256;

export function App(): JSX.Element {
	const [state, setState] = useState<AppState>({ phase: 'loading' });

	useEffect(() => {
		// Subscribe to session changes
		const unsubSession = messageBus.on('sessionChanged', (payload) => {
			setState((prev) => {
				if (payload.session.status === 'none' || !payload.session.sessionId) {
					return { phase: 'no-session' };
				}
				// Keep document if we have one, otherwise go to no-document
				if (prev.phase === 'ready' || prev.phase === 'loading-memory') {
					return { ...prev, session: payload.session };
				}
				return { phase: 'no-document', session: payload.session };
			});
		});

		// Subscribe to document changes
		const unsubDoc = messageBus.on('documentChanged', (payload) => {
			setState((prev) => {
				if (!payload.document) {
					if ('session' in prev) {
						return { phase: 'no-document', session: prev.session };
					}
					return { phase: 'no-session' };
				}
				if ('session' in prev) {
					return {
						phase: 'loading-memory',
						session: prev.session,
						document: payload.document,
					};
				}
				return prev;
			});
		});

		// Initialize
		init();

		return () => {
			unsubSession();
			unsubDoc();
		};
	}, []);

	// Load memory when we have a document and session is stopped
	useEffect(() => {
		if (state.phase === 'loading-memory' && state.session.status === 'stopped') {
			loadMemory(state.session, state.document);
		}
	}, [state]);

	async function init(): Promise<void> {
		try {
			const result = await HostClient.init();

			if (!result.session.sessionId) {
				setState({ phase: 'no-session' });
				return;
			}

			if (!result.activeDocument) {
				setState({ phase: 'no-document', session: result.session });
				return;
			}

			setState({
				phase: 'loading-memory',
				session: result.session,
				document: result.activeDocument,
			});
		} catch (err) {
			setState({
				phase: 'error',
				session: { sessionId: null, status: 'none' },
				document: null,
				error: err instanceof Error ? err.message : 'Failed to initialize',
			});
		}
	}

	async function loadMemory(
		session: SessionSnapshot,
		document: DocumentSnapshot
	): Promise<void> {
		try {
			const result = await HostClient.readMemory(
				document.id,
				0,
				INITIAL_BYTE_COUNT
			);

			setState({
				phase: 'ready',
				session,
				document,
				memory: { address: result.address, data: result.data },
			});
		} catch (err) {
			setState({
				phase: 'error',
				session,
				document,
				error: err instanceof Error ? err.message : 'Failed to read memory',
			});
		}
	}

	const handleOpenDocument = useCallback(async (target: string) => {
		setState((prev) => {
			if ('session' in prev) {
				return { phase: 'opening-document', session: prev.session };
			}
			return prev;
		});

		try {
			const result = await HostClient.openDocument(target);
			// Document changed event will trigger state transition to loading-memory
			setState((prev) => {
				if ('session' in prev) {
					return {
						phase: 'loading-memory',
						session: prev.session,
						document: result.document,
					};
				}
				return prev;
			});
		} catch (err) {
			setState((prev) => {
				const session = 'session' in prev ? prev.session : { sessionId: null, status: 'none' as const };
				const document = 'document' in prev ? prev.document : null;
				return {
					phase: 'error',
					session,
					document,
					error: err instanceof Error ? err.message : 'Failed to open document',
				};
			});
		}
	}, []);

	const handleRefresh = useCallback(() => {
		if (state.phase === 'ready') {
			setState({
				phase: 'loading-memory',
				session: state.session,
				document: state.document,
			});
		}
	}, [state]);

	const sessionStatus = 'session' in state ? state.session.status : 'none';
	const isLoading = state.phase === 'loading' || 
		state.phase === 'opening-document' || 
		state.phase === 'loading-memory';

	return (
		<div style={styles.container}>
			<Toolbar
				sessionStatus={sessionStatus}
				onOpenDocument={handleOpenDocument}
				onRefresh={handleRefresh}
				isLoading={isLoading}
			/>
			<div style={styles.content}>{renderContent(state)}</div>
			<StatusBar
				status={sessionStatus}
				sessionId={'session' in state ? state.session.sessionId : null}
				documentAddress={'document' in state && state.document ? state.document.address : null}
				error={state.phase === 'error' ? state.error : null}
			/>
		</div>
	);
}

function renderContent(state: AppState): JSX.Element {
	switch (state.phase) {
		case 'loading':
			return <Message>Loading...</Message>;

		case 'no-session':
			return (
				<Message>
					No active debug session.
					<br />
					Start debugging to use memory inspection.
				</Message>
			);

		case 'no-document':
			return (
				<Message>
					Enter an address or expression in the toolbar above,
					<br />
					or click PC, SP, or LR to view memory at those registers.
				</Message>
			);

		case 'opening-document':
			return <Message>Resolving address...</Message>;

		case 'loading-memory':
			if (state.session.status !== 'stopped') {
				return (
					<Message>
						Debug session is running.
						<br />
						Pause execution to read memory.
					</Message>
				);
			}
			return <Message>Reading memory...</Message>;

		case 'ready':
			return <MemoryGrid address={state.memory.address} data={state.memory.data} />;

		case 'error':
			return <Message error>{state.error}</Message>;
	}
}

interface MessageProps {
	children: React.ReactNode;
	error?: boolean;
}

function Message({ children, error }: MessageProps): JSX.Element {
	return (
		<div
			style={{
				...styles.message,
				color: error
					? 'var(--vscode-errorForeground)'
					: 'var(--vscode-descriptionForeground)',
			}}
		>
			{children}
		</div>
	);
}

const styles: Record<string, React.CSSProperties> = {
	container: {
		display: 'flex',
		flexDirection: 'column',
		height: '100vh',
	},
	content: {
		flex: 1,
		overflow: 'auto',
	},
	message: {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		height: '100%',
		textAlign: 'center',
		padding: '20px',
		lineHeight: 1.6,
	},
};
