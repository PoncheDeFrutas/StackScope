import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import type {
	DebugNavigationMode,
	DisassemblySnapshot,
	SessionSnapshot,
	StackSelectionSnapshot,
	StackThreadSnapshot,
} from '../protocol/methods.js';
import { HostClient } from './rpc/HostClient.js';
import { messageBus } from './rpc/WebviewMessageBus.js';

declare global {
	interface Window {
		__STACKSCOPE_NAV_MODE__?: DebugNavigationMode | null;
	}
}

interface DebugNavigationState {
	session: SessionSnapshot;
	mode: DebugNavigationMode;
	threads: StackThreadSnapshot[];
	selection: StackSelectionSnapshot;
	callStackError: string | null;
	frame: DisassemblySnapshot['frame'];
	instructions: DisassemblySnapshot['instructions'];
	disassemblyError: string | null;
}

const EMPTY_SELECTION: StackSelectionSnapshot = { threadId: null, frameId: null };

const INITIAL_MODE: DebugNavigationMode = window.__STACKSCOPE_NAV_MODE__ ?? 'call-stack';

export function DebugNavigationApp(): JSX.Element {
	const [state, setState] = useState<DebugNavigationState>({
		session: { sessionId: null, status: 'none' },
		mode: INITIAL_MODE,
		threads: [],
		selection: EMPTY_SELECTION,
		callStackError: null,
		frame: null,
		instructions: [],
		disassemblyError: null,
	});
	const [isInitializing, setIsInitializing] = useState(true);
	const [isCallStackLoading, setIsCallStackLoading] = useState(false);
	const [isDisassemblyInitialLoading, setIsDisassemblyInitialLoading] = useState(
		INITIAL_MODE === 'disassembly'
	);
	const [isDisassemblyRefreshing, setIsDisassemblyRefreshing] = useState(false);
	const [pendingFrameId, setPendingFrameId] = useState<number | null>(null);
	const [, startTransition] = useTransition();
	const modeRef = useRef<DebugNavigationMode>(INITIAL_MODE);
	const hasDisassemblyContentRef = useRef(false);
	const currentInstructionKeyRef = useRef<string | null>(null);

	useEffect(() => {
		hasDisassemblyContentRef.current = hasRenderableDisassembly(state);
	}, [state.frame, state.instructions]);

	useEffect(() => {
		modeRef.current = state.mode;
	}, [state.mode]);

	useEffect(() => {
		const unsubSession = messageBus.on('sessionChanged', (payload) => {
			setState((prev) => ({
				...prev,
				session: payload.session,
			}));

			if (payload.session.status === 'stopped') {
				startTransition(() => {
					void loadCallStack();
					if (modeRef.current === 'disassembly' || hasDisassemblyContentRef.current) {
						void loadDisassembly(true);
					}
				});
			} else if (payload.session.status === 'running' && hasDisassemblyContentRef.current) {
				setIsDisassemblyRefreshing(true);
				setIsDisassemblyInitialLoading(false);
			} else {
				setIsCallStackLoading(false);
				setIsDisassemblyRefreshing(false);
				setIsDisassemblyInitialLoading(false);
				setPendingFrameId(null);
			}
		});

		const unsubCallStack = messageBus.on('callStackChanged', (payload) => {
			setState((prev) => {
				const preserveExisting =
					prev.session.status !== 'stopped' &&
					payload.threads.length === 0 &&
					prev.threads.length > 0;

				return {
					...prev,
					threads: preserveExisting ? prev.threads : payload.threads,
					selection: preserveExisting ? prev.selection : payload.selection,
					callStackError: null,
				};
			});
			setPendingFrameId(null);
			setIsCallStackLoading(false);
			setIsInitializing(false);
		});

		const unsubDisassembly = messageBus.on('disassemblyChanged', (payload) => {
			setState((prev) => {
				const preserveExisting =
					prev.session.status !== 'stopped' &&
					payload.instructions.length === 0 &&
					prev.instructions.length > 0;

				return {
					...prev,
					selection: preserveExisting ? prev.selection : payload.selection,
					frame: preserveExisting ? prev.frame : payload.frame,
					instructions: preserveExisting ? prev.instructions : payload.instructions,
					disassemblyError: preserveExisting ? prev.disassemblyError : payload.error ?? null,
				};
			});
			setIsDisassemblyRefreshing(false);
			setIsDisassemblyInitialLoading(false);
			setIsInitializing(false);
		});

		const unsubMode = messageBus.on('debugNavigationModeChanged', (payload) => {
			void switchMode(payload.mode);
		});

		void init();

		return () => {
			unsubSession();
			unsubCallStack();
			unsubDisassembly();
			unsubMode();
		};
	}, []);

	useEffect(() => {
		const nextInstructionKey = getCurrentInstructionKey(state.instructions);
		if (!nextInstructionKey || nextInstructionKey === currentInstructionKeyRef.current) {
			return;
		}

		currentInstructionKeyRef.current = nextInstructionKey;
		const current = document.querySelector<HTMLElement>('[data-current-instruction="true"]');
		current?.scrollIntoView({ block: 'center' });
	}, [state.instructions]);

	async function init(): Promise<void> {
		try {
			const result = await HostClient.init();
			setState((prev) => ({
				...prev,
				session: result.session,
			}));

			if (result.session.status === 'stopped') {
				await loadCallStack();
				if (INITIAL_MODE === 'disassembly') {
					await loadDisassembly(false);
				} else {
					setIsDisassemblyInitialLoading(false);
				}
			} else {
				setIsInitializing(false);
				setIsDisassemblyInitialLoading(false);
			}
		} catch (err) {
			setState((prev) => ({
				...prev,
				callStackError: err instanceof Error ? err.message : 'Failed to initialize navigation',
			}));
			setIsInitializing(false);
			setIsCallStackLoading(false);
			setIsDisassemblyRefreshing(false);
			setIsDisassemblyInitialLoading(false);
		}
	}

	async function loadCallStack(): Promise<void> {
		setIsCallStackLoading(true);
		try {
			const result = await HostClient.listCallStack();
			setState((prev) => ({
				...prev,
				threads: result.threads,
				selection: result.selection,
				callStackError: null,
			}));
		} catch (err) {
			setState((prev) => ({
				...prev,
				callStackError: err instanceof Error ? err.message : 'Failed to load call stack',
				threads: prev.session.status === 'stopped' ? [] : prev.threads,
				selection: prev.session.status === 'stopped' ? EMPTY_SELECTION : prev.selection,
			}));
		} finally {
			setIsCallStackLoading(false);
			setIsInitializing(false);
		}
	}

	async function loadDisassembly(preserveExisting: boolean): Promise<void> {
		const keepCurrentContent = preserveExisting && hasDisassemblyContentRef.current;
		if (keepCurrentContent) {
			setIsDisassemblyRefreshing(true);
		} else {
			setIsDisassemblyInitialLoading(true);
		}

		try {
			const result = await HostClient.getDisassembly();
			setState((prev) => ({
				...prev,
				selection: result.selection,
				frame: result.frame,
				instructions: result.instructions,
				disassemblyError: result.error ?? null,
			}));
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to load disassembly';
			setState((prev) => ({
				...prev,
				frame: keepCurrentContent ? prev.frame : null,
				instructions: keepCurrentContent ? prev.instructions : [],
				disassemblyError: message,
			}));
		} finally {
			setIsDisassemblyRefreshing(false);
			setIsDisassemblyInitialLoading(false);
			setIsInitializing(false);
		}
	}

	async function handleSelectFrame(
		threadId: number,
		frameId: number,
		frameIndex: number,
		frame: StackThreadSnapshot['frames'][number]
	): Promise<void> {
		setPendingFrameId(frameId);
		try {
			const result = await HostClient.selectStackFrame(threadId, frameId, {
				frameIndex,
				frameName: frame.name,
				sourcePath: frame.sourcePath,
				line: frame.line,
				column: frame.column,
			});
			setState((prev) => ({
				...prev,
				mode: 'disassembly',
				selection: result.selection,
				callStackError: null,
			}));
			if (hasDisassemblyContentRef.current) {
				setIsDisassemblyRefreshing(true);
			} else {
				setIsDisassemblyInitialLoading(true);
			}
		} catch (err) {
			setState((prev) => ({
				...prev,
				callStackError: err instanceof Error ? err.message : 'Failed to select frame',
			}));
			setPendingFrameId(null);
		}
	}

	async function switchMode(mode: DebugNavigationMode): Promise<void> {
		setState((prev) => ({
			...prev,
			mode,
		}));

		if (mode === 'call-stack') {
			if (
				state.session.status === 'stopped' &&
				state.threads.length === 0 &&
				!isCallStackLoading
			) {
				await loadCallStack();
			}
			return;
		}

		if (state.session.status === 'stopped' && !hasRenderableDisassembly(state)) {
			await loadDisassembly(false);
		}
	}

	if (isInitializing && state.session.sessionId === null) {
		return <Message>Loading debug navigation...</Message>;
	}

	if (state.session.status === 'none' || !state.session.sessionId) {
		return <Message>No active debug session.</Message>;
	}

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<div>
					<div style={styles.title}>Debug Navigation</div>
					<div style={styles.subtitle}>{formatSubtitle(state)}</div>
				</div>
				<div style={styles.headerActions}>
					<div style={styles.modeTabs}>
						<button
							onClick={() => void switchMode('call-stack')}
							style={{
								...styles.modeTab,
								...(state.mode === 'call-stack' ? styles.modeTabActive : {}),
							}}
						>
							Call Stack
						</button>
						<button
							onClick={() => void switchMode('disassembly')}
							style={{
								...styles.modeTab,
								...(state.mode === 'disassembly' ? styles.modeTabActive : {}),
							}}
						>
							Disassembly
						</button>
					</div>
					{state.mode === 'disassembly' && (isDisassemblyRefreshing || isRunningWithDisassembly(state)) ? (
						<span style={styles.syncBadge}>Syncing</span>
					) : null}
					<button
						onClick={() =>
							void (state.mode === 'call-stack' ? loadCallStack() : loadDisassembly(true))
						}
						style={styles.refreshButton}
						disabled={state.mode === 'call-stack' ? isCallStackLoading : isDisassemblyRefreshing}
					>
						Refresh
					</button>
				</div>
			</div>
			{state.mode === 'call-stack' ? renderCallStack(state, isCallStackLoading, pendingFrameId, handleSelectFrame) : renderDisassembly(state, isDisassemblyInitialLoading, isDisassemblyRefreshing)}
		</div>
	);
}

function renderCallStack(
	state: DebugNavigationState,
	isLoading: boolean,
	pendingFrameId: number | null,
	onSelectFrame: (
		threadId: number,
		frameId: number,
		frameIndex: number,
		frame: StackThreadSnapshot['frames'][number]
	) => Promise<void>
): JSX.Element {
	if (isLoading && state.threads.length === 0) {
		return <Message>Loading call stack...</Message>;
	}

	if (state.session.status !== 'stopped' && state.threads.length === 0) {
		return <Message>Pause execution to inspect threads and frames.</Message>;
	}

	if (state.callStackError && state.threads.length === 0) {
		return <Message error>{state.callStackError}</Message>;
	}

	if (state.threads.length === 0) {
		return <Message>No stack frames available.</Message>;
	}

	return (
		<>
			{state.callStackError ? <div style={styles.errorBanner}>{state.callStackError}</div> : null}
			<div
				style={{
					...styles.threadList,
					opacity: isLoading || state.session.status !== 'stopped' ? 0.72 : 1,
				}}
			>
				{state.threads.map((thread) => (
					<section key={thread.id} style={styles.threadSection}>
						<div style={styles.threadHeader}>
							<span>{thread.name}</span>
							<span style={styles.threadMeta}>{thread.frames.length} frames</span>
						</div>
						{thread.frames.length === 0 ? (
							<div style={styles.emptyThread}>No frames available.</div>
						) : (
							thread.frames.map((frame, frameIndex) => {
								const isSelected =
									state.selection.threadId === thread.id &&
									state.selection.frameId === frame.id;
								const isPending = pendingFrameId === frame.id;

								return (
									<button
										key={frame.id}
										onClick={() =>
											void onSelectFrame(thread.id, frame.id, frameIndex, frame)
										}
										style={{
											...styles.frameButton,
											...(isSelected ? styles.frameButtonSelected : {}),
										}}
									>
										<div style={styles.frameNameRow}>
											<span style={styles.frameName}>{frame.name}</span>
											{isSelected && <span style={styles.badge}>Selected</span>}
											{isPending && <span style={styles.badgeMuted}>Syncing</span>}
										</div>
										<div style={styles.frameLocation}>
											{formatFrameLocation(frame)}
										</div>
									</button>
								);
							})
						)}
					</section>
				))}
			</div>
		</>
	);
}

function renderDisassembly(
	state: DebugNavigationState,
	isInitialLoading: boolean,
	isRefreshing: boolean
): JSX.Element {
	const hasContent = hasRenderableDisassembly(state);
	const showSyncing = isRefreshing || isRunningWithDisassembly(state);
	const contentOpacity = showSyncing ? 0.7 : 1;

	if (isInitialLoading && !hasContent) {
		return <Message>Loading disassembly...</Message>;
	}

	if (state.session.status !== 'stopped' && !hasContent) {
		return <Message>Pause execution to inspect disassembly.</Message>;
	}

	return (
		<>
			{state.disassemblyError ? (
				<div style={styles.errorBanner}>{state.disassemblyError}</div>
			) : null}
			{state.frame === null ? (
				<Message>Select a frame from Call Stack.</Message>
			) : state.instructions.length === 0 ? (
				<Message>No instructions available for the selected frame.</Message>
			) : (
				<div
					style={{
						...styles.list,
						opacity: contentOpacity,
					}}
				>
					{state.instructions.map((instruction, index) => (
						<div
							key={`${instruction.address}-${index}`}
							data-current-instruction={instruction.isCurrent ? 'true' : 'false'}
							style={{
								...styles.row,
								...(instruction.isCurrent ? styles.rowCurrent : {}),
							}}
						>
							<div style={styles.marker}>{instruction.isCurrent ? '>' : ''}</div>
							<div style={styles.address}>{instruction.address}</div>
							<div style={styles.bytes}>{instruction.instructionBytes ?? ''}</div>
							<div style={styles.instruction}>{instruction.instruction}</div>
							<div style={styles.meta}>{formatInstructionMeta(instruction)}</div>
						</div>
					))}
				</div>
			)}
		</>
	);
}

function formatSubtitle(state: DebugNavigationState): string {
	if (state.mode === 'call-stack') {
		return 'StackScope frame context';
	}

	if (state.frame?.sourceName || state.frame?.sourcePath) {
		const source = state.frame.sourceName ?? state.frame.sourcePath ?? 'Unknown source';
		if (state.frame.line) {
			return `${state.frame.name} • ${source}:${state.frame.line}${state.frame.column ? `:${state.frame.column}` : ''}`;
		}
		return `${state.frame.name} • ${source}`;
	}

	if (state.frame?.instructionPointerReference) {
		return `${state.frame.name} • ${state.frame.instructionPointerReference}`;
	}

	return 'Instruction flow';
}

function formatFrameLocation(frame: StackThreadSnapshot['frames'][number]): string {
	if (frame.sourceName || frame.sourcePath) {
		const source = frame.sourceName ?? frame.sourcePath ?? 'Unknown source';
		if (frame.line) {
			return `${source}:${frame.line}${frame.column ? `:${frame.column}` : ''}`;
		}
		return source;
	}

	if (frame.instructionPointerReference) {
		return frame.instructionPointerReference;
	}

	return 'No source information';
}

function formatInstructionMeta(
	instruction: DisassemblySnapshot['instructions'][number]
): string {
	if (instruction.sourceName || instruction.sourcePath) {
		const source = instruction.sourceName ?? instruction.sourcePath ?? 'Unknown source';
		if (instruction.line) {
			return `${source}:${instruction.line}${instruction.column ? `:${instruction.column}` : ''}`;
		}
		return source;
	}

	return instruction.symbol ?? '';
}

function hasRenderableDisassembly(state: Pick<DebugNavigationState, 'frame' | 'instructions'>): boolean {
	return state.frame !== null && state.instructions.length > 0;
}

function isRunningWithDisassembly(state: Pick<DebugNavigationState, 'session' | 'frame' | 'instructions'>): boolean {
	return state.session.status === 'running' && hasRenderableDisassembly(state);
}

function getCurrentInstructionKey(
	instructions: DisassemblySnapshot['instructions']
): string | null {
	const current = instructions.find((instruction) => instruction.isCurrent);
	return current ? current.address : null;
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

const styles: Record<string, CSSProperties> = {
	container: {
		display: 'flex',
		flexDirection: 'column',
		height: '100vh',
		backgroundColor: 'var(--vscode-editor-background)',
	},
	header: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '10px 12px',
		borderBottom: '1px solid var(--vscode-widget-border)',
		gap: 12,
	},
	headerActions: {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
	},
	modeTabs: {
		display: 'inline-flex',
		border: '1px solid var(--vscode-widget-border)',
		borderRadius: 6,
		overflow: 'hidden',
	},
	modeTab: {
		border: 'none',
		background: 'transparent',
		color: 'var(--vscode-foreground)',
		padding: '6px 10px',
		cursor: 'pointer',
	},
	modeTabActive: {
		background: 'var(--vscode-button-secondaryBackground)',
	},
	title: {
		fontSize: '13px',
		fontWeight: 600,
	},
	subtitle: {
		marginTop: 2,
		fontSize: '11px',
		color: 'var(--vscode-descriptionForeground)',
	},
	refreshButton: {
		border: '1px solid var(--vscode-button-border, transparent)',
		background: 'var(--vscode-button-secondaryBackground)',
		color: 'var(--vscode-button-secondaryForeground)',
		padding: '5px 10px',
		borderRadius: 4,
		cursor: 'pointer',
	},
	syncBadge: {
		fontSize: '11px',
		color: 'var(--vscode-descriptionForeground)',
		backgroundColor: 'color-mix(in srgb, var(--vscode-button-secondaryBackground) 70%, transparent)',
		border: '1px solid var(--vscode-widget-border)',
		borderRadius: 999,
		padding: '2px 8px',
	},
	errorBanner: {
		padding: '8px 12px',
		fontSize: '12px',
		color: 'var(--vscode-errorForeground)',
		borderBottom: '1px solid color-mix(in srgb, var(--vscode-errorForeground) 25%, transparent)',
		backgroundColor: 'color-mix(in srgb, var(--vscode-errorForeground) 8%, transparent)',
	},
	threadList: {
		flex: 1,
		overflow: 'auto',
		padding: 12,
		transition: 'opacity 120ms linear',
	},
	threadSection: {
		marginBottom: 14,
	},
	threadHeader: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
		fontSize: '12px',
		fontWeight: 600,
	},
	threadMeta: {
		fontSize: '11px',
		color: 'var(--vscode-descriptionForeground)',
	},
	emptyThread: {
		padding: '8px 10px',
		fontSize: '12px',
		color: 'var(--vscode-descriptionForeground)',
		border: '1px dashed var(--vscode-widget-border)',
		borderRadius: 6,
	},
	frameButton: {
		display: 'block',
		width: '100%',
		textAlign: 'left',
		border: '1px solid var(--vscode-widget-border)',
		background: 'transparent',
		color: 'var(--vscode-foreground)',
		padding: '8px 10px',
		borderRadius: 6,
		marginBottom: 8,
		cursor: 'pointer',
	},
	frameButtonSelected: {
		background: 'color-mix(in srgb, var(--vscode-list-activeSelectionBackground) 16%, transparent)',
	},
	frameNameRow: {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
	},
	frameName: {
		fontWeight: 600,
		fontSize: '12px',
	},
	frameLocation: {
		marginTop: 4,
		fontSize: '11px',
		color: 'var(--vscode-descriptionForeground)',
	},
	badge: {
		fontSize: '10px',
		padding: '2px 6px',
		borderRadius: 999,
		background: 'var(--vscode-button-secondaryBackground)',
		color: 'var(--vscode-button-secondaryForeground)',
	},
	badgeMuted: {
		fontSize: '10px',
		padding: '2px 6px',
		borderRadius: 999,
		background: 'transparent',
		border: '1px solid var(--vscode-widget-border)',
		color: 'var(--vscode-descriptionForeground)',
	},
	list: {
		flex: 1,
		overflow: 'auto',
		fontFamily: 'var(--vscode-editor-font-family)',
		fontSize: '12px',
		transition: 'opacity 120ms linear',
	},
	row: {
		display: 'grid',
		gridTemplateColumns: '18px 120px 120px minmax(260px, 1fr) minmax(160px, 220px)',
		gap: 12,
		alignItems: 'center',
		padding: '6px 12px',
		borderBottom: '1px solid color-mix(in srgb, var(--vscode-widget-border) 45%, transparent)',
		whiteSpace: 'pre',
	},
	rowCurrent: {
		backgroundColor: 'color-mix(in srgb, var(--vscode-list-activeSelectionBackground) 18%, transparent)',
		color: 'var(--vscode-editor-foreground)',
	},
	marker: {
		color: 'var(--vscode-debugIcon-breakpointCurrentStackframeForeground, var(--vscode-charts-green))',
		fontWeight: 700,
	},
	address: {
		color: 'var(--vscode-textPreformat-foreground)',
	},
	bytes: {
		color: 'var(--vscode-descriptionForeground)',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
	},
	instruction: {
		overflow: 'hidden',
		textOverflow: 'ellipsis',
	},
	meta: {
		color: 'var(--vscode-descriptionForeground)',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
	},
	message: {
		display: 'flex',
		flex: 1,
		minHeight: 0,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 16,
		textAlign: 'center',
	},
};
