import { useState, useEffect, useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { HostClient } from './rpc/HostClient.js';
import { messageBus } from './rpc/WebviewMessageBus.js';
import { VirtualMemoryGrid } from './components/VirtualMemoryGrid.js';
import { StatusBar } from './components/StatusBar.js';
import { Toolbar } from './components/Toolbar.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { RegisterPanel, type RegisterValueFormat } from './components/RegisterPanel.js';
import { RegisterSetEditor } from './components/RegisterSetEditor.js';
import { usePagedMemory } from './hooks/usePagedMemory.js';
import {
	captureBaselineFromPages,
	diffPagesAgainstBaseline,
	getChangedByteCount,
	type ByteChangeMap,
} from './changeTracking.js';
import type {
	SessionSnapshot,
	DocumentSnapshot,
	PresetSnapshot,
	RegisterSetSnapshot,
	RegisterValueSnapshot,
	RegisterItemSnapshot,
} from '../protocol/methods.js';
import type { MemoryViewConfig } from '../domain/config/MemoryViewConfig.js';
import { DEFAULT_CONFIG } from '../domain/config/MemoryViewConfig.js';

type AppState =
	| { phase: 'loading' }
	| { phase: 'no-session' }
	| { phase: 'no-document'; session: SessionSnapshot }
	| { phase: 'opening-document'; session: SessionSnapshot }
	| { phase: 'ready'; session: SessionSnapshot; document: DocumentSnapshot }
	| { phase: 'error'; session: SessionSnapshot; document: DocumentSnapshot | null; error: string };

const DEFAULT_REGISTER_PANEL_WIDTH = 320;
const MIN_REGISTER_PANEL_WIDTH = 240;
const MIN_REGISTER_PANEL_WIDTH_FALLBACK = 180;
const MAX_REGISTER_PANEL_RATIO = 0.45;
const VIEW_STATE_SAVE_DEBOUNCE_MS = 200;

export function App(): JSX.Element {
	const [state, setState] = useState<AppState>({ phase: 'loading' });
	const [config, setConfig] = useState<MemoryViewConfig>(DEFAULT_CONFIG);
	const [presets, setPresets] = useState<PresetSnapshot[]>([]);
	const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [currentTarget, setCurrentTarget] = useState('');

	// Register state
	const [registerSets, setRegisterSets] = useState<RegisterSetSnapshot[]>([]);
	const [selectedRegisterSetId, setSelectedRegisterSetId] = useState<string>('builtin-core');
	const [registerValues, setRegisterValues] = useState<RegisterValueSnapshot[]>([]);
	const [registersStale, setRegistersStale] = useState(false);
	const [registersLoading, setRegistersLoading] = useState(false);
	const [registerValueFormat, setRegisterValueFormat] = useState<RegisterValueFormat>('hex');
	const [showRegisterPanel, setShowRegisterPanel] = useState(true);
	const [registerPanelWidth, setRegisterPanelWidth] = useState(DEFAULT_REGISTER_PANEL_WIDTH);
	const [isResizingRegisterPanel, setIsResizingRegisterPanel] = useState(false);
	const [editingRegisterSet, setEditingRegisterSet] = useState<RegisterSetSnapshot | null | 'new'>(null);
	const [viewStateReady, setViewStateReady] = useState(false);
	const splitContainerRef = useRef<HTMLDivElement>(null);
	const configRef = useRef(config);
	const pendingRestoreTargetRef = useRef<string | null>(null);
	const restoreAttemptSessionIdRef = useRef<string | null>(null);

	// Paged memory state
	const pagedMemory = usePagedMemory();

	// Track previous data for change highlighting
	const [changedBytes, setChangedBytes] = useState<ByteChangeMap>(new Map());
	const baselineRef = useRef<Map<number, number | null>>(new Map());

	// Track if we need to refresh on next stopped event
	const pendingRefreshRef = useRef(false);
	const pendingRegisterRefreshRef = useRef(false);

	useEffect(() => {
		configRef.current = config;
	}, [config]);

	useEffect(() => {
		// Subscribe to session changes
		const unsubSession = messageBus.on('sessionChanged', (payload) => {
			setState((prev) => {
				if (payload.session.status === 'none' || !payload.session.sessionId) {
					restoreAttemptSessionIdRef.current = null;
					baselineRef.current = new Map();
					setChangedBytes(new Map());
					return { phase: 'no-session' };
				}

				// When session becomes stopped, trigger data refresh
				if (payload.session.status === 'stopped') {
					if (prev.phase === 'ready') {
						// Trigger silent refresh of loaded pages
						pendingRefreshRef.current = true;
						pendingRegisterRefreshRef.current = true;
						return { ...prev, session: payload.session };
					}
					if (prev.phase === 'error' && prev.document) {
						return {
							phase: 'ready',
							session: payload.session,
							document: prev.document,
						};
					}
					if (prev.phase === 'no-document') {
						pendingRegisterRefreshRef.current = true;
						return { ...prev, session: payload.session };
					}
				}

				// When transitioning to running, save baseline for change detection
				if (payload.session.status === 'running' && prev.phase === 'ready') {
					baselineRef.current = captureBaselineFromPages(pagedMemory.state.pages);
					setChangedBytes(new Map());
					// Mark registers as stale when running
					setRegistersStale(true);
				}

				// Keep document if we have one, otherwise go to no-document
				if (prev.phase === 'ready') {
					return { ...prev, session: payload.session };
				}
				return { phase: 'no-document', session: payload.session };
			});
		});

		// Subscribe to document changes
		const unsubDoc = messageBus.on('documentChanged', (payload) => {
			setState((prev) => {
				if (!payload.document) {
					baselineRef.current = new Map();
					setChangedBytes(new Map());
					if ('session' in prev) {
						return { phase: 'no-document', session: prev.session };
					}
					return { phase: 'no-session' };
				}
				if ('session' in prev) {
					// Reset paged memory for new document
					pagedMemory.reset(
						payload.document.id,
						payload.document.address,
						configRef.current.totalSize
					);
					baselineRef.current = new Map();
					setChangedBytes(new Map());
					setCurrentTarget(payload.document.address);
					return {
						phase: 'ready',
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

	useEffect(() => {
		const container = splitContainerRef.current;
		if (!container) {
			return;
		}

		const clampWidth = () => {
			setRegisterPanelWidth((prev) => clampRegisterPanelWidth(prev, container.clientWidth));
		};

		clampWidth();

		const observer = new ResizeObserver(clampWidth);
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!viewStateReady) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			void HostClient.saveViewState({
				currentTarget,
				config,
				showSettings,
				showRegisterPanel,
				registerPanelWidth,
				registerValueFormat,
			}).catch((err) => {
				console.error('Failed to save view state:', err);
			});
		}, VIEW_STATE_SAVE_DEBOUNCE_MS);

		return () => window.clearTimeout(timeoutId);
	}, [
		viewStateReady,
		currentTarget,
		config,
		showSettings,
		showRegisterPanel,
		registerPanelWidth,
		registerValueFormat,
	]);

	// Handle pending refresh when stopped
	useEffect(() => {
		if (pendingRefreshRef.current && state.phase === 'ready' && state.session.status === 'stopped') {
			pendingRefreshRef.current = false;
			handleRefreshInternal();
		}
	}, [state]);

	// Handle pending register refresh when stopped
	useEffect(() => {
		const sessionStatus = 'session' in state ? state.session.status : 'none';
		if (pendingRegisterRefreshRef.current && sessionStatus === 'stopped') {
			pendingRegisterRefreshRef.current = false;
			loadRegisters(selectedRegisterSetId);
		}
	}, [state, selectedRegisterSetId]);

	async function init(): Promise<void> {
		try {
			const result = await HostClient.init();
			const restoredViewState = result.viewState;
			const restoredConfig = restoredViewState?.config ?? DEFAULT_CONFIG;
			const restoredTarget = result.activeDocument?.address ?? restoredViewState?.currentTarget ?? '';

			// Store presets from init
			setPresets(result.presets);

			// Store register sets from init
			setRegisterSets(result.registerSets);
			setSelectedRegisterSetId(result.selectedRegisterSetId);
			setConfig(restoredConfig);
			setShowSettings(restoredViewState?.showSettings ?? false);
			setShowRegisterPanel(restoredViewState?.showRegisterPanel ?? true);
			setRegisterPanelWidth(restoredViewState?.registerPanelWidth ?? DEFAULT_REGISTER_PANEL_WIDTH);
			setRegisterValueFormat(restoredViewState?.registerValueFormat ?? 'hex');
			setCurrentTarget(restoredTarget);

			if (restoredTarget) {
				pendingRestoreTargetRef.current = restoredTarget;
			}
			setViewStateReady(true);

			if (!result.session.sessionId) {
				setState({ phase: 'no-session' });
				return;
			}

			if (!result.activeDocument) {
				setState({ phase: 'no-document', session: result.session });
				// Load registers if session is stopped
				if (result.session.status === 'stopped') {
					loadRegisters(result.selectedRegisterSetId);
				}
				return;
			}

			pendingRestoreTargetRef.current = null;

			// Initialize paged memory
			pagedMemory.reset(
				result.activeDocument.id,
				result.activeDocument.address,
				restoredConfig.totalSize
			);

			setState({
				phase: 'ready',
				session: result.session,
				document: result.activeDocument,
			});

			// Load registers if session is stopped
			if (result.session.status === 'stopped') {
				loadRegisters(result.selectedRegisterSetId);
			}
		} catch (err) {
			setState({
				phase: 'error',
				session: { sessionId: null, status: 'none' },
				document: null,
				error: err instanceof Error ? err.message : 'Failed to initialize',
			});
		}
	}

	/** Loads register values for the selected set */
	async function loadRegisters(setId: string): Promise<void> {
		setRegistersLoading(true);
		try {
			const result = await HostClient.readRegisters(setId);
			setRegisterValues(result.values);
			setRegistersStale(false);
		} catch (err) {
			console.error('Failed to load registers:', err);
			setRegistersStale(true);
		} finally {
			setRegistersLoading(false);
		}
	}

	/** Internal refresh that compares with baseline for highlighting */
	async function handleRefreshInternal(): Promise<void> {
		if (state.phase !== 'ready') return;

		await pagedMemory.refreshAll();

		setChangedBytes(
			diffPagesAgainstBaseline(
				pagedMemory.state.pages,
				baselineRef.current,
				Date.now()
			)
		);

		// Also refresh registers
		loadRegisters(selectedRegisterSetId);
	}

	const handleOpenDocument = useCallback(async (
		target: string,
		options?: { preservePendingRestore?: boolean }
	): Promise<boolean> => {
		setCurrentTarget(target);
		setSelectedPresetId(null);
		if (!options?.preservePendingRestore) {
			pendingRestoreTargetRef.current = null;
			restoreAttemptSessionIdRef.current = null;
		}
		setState((prev) => {
			if ('session' in prev) {
				return { phase: 'opening-document', session: prev.session };
			}
			return prev;
		});

		try {
			const result = await HostClient.openDocument(target);

			// Reset paged memory for new document
			pagedMemory.reset(result.document.id, result.document.address, config.totalSize);

			// Clear change tracking
			baselineRef.current = new Map();
			setChangedBytes(new Map());

			setState((prev) => {
				if ('session' in prev) {
					return {
						phase: 'ready',
						session: prev.session,
						document: result.document,
					};
				}
				return prev;
			});
			return true;
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
			return false;
		}
	}, [config.totalSize, pagedMemory]);

	useEffect(() => {
		const sessionId = 'session' in state ? state.session.sessionId : null;
		const sessionStatus = 'session' in state ? state.session.status : 'none';
		const target = pendingRestoreTargetRef.current;

		if (
			!viewStateReady ||
			!target ||
			!sessionId ||
			sessionStatus !== 'stopped' ||
			state.phase === 'ready' ||
			restoreAttemptSessionIdRef.current === sessionId
		) {
			return;
		}

		restoreAttemptSessionIdRef.current = sessionId;

		void handleOpenDocument(target, { preservePendingRestore: true }).then((success) => {
			if (success) {
				pendingRestoreTargetRef.current = null;
				restoreAttemptSessionIdRef.current = null;
			}
		});
	}, [state, handleOpenDocument, viewStateReady]);

	const handleSelectPreset = useCallback((preset: PresetSnapshot | null) => {
		if (preset) {
			setSelectedPresetId(preset.id);
			setCurrentTarget(preset.target);
			handleOpenDocument(preset.target);
		} else {
			setSelectedPresetId(null);
		}
	}, [handleOpenDocument]);

	const handleSavePreset = useCallback(async (name: string, target: string) => {
		try {
			const result = await HostClient.savePreset(name, target);
			setPresets((prev) => [...prev, result.preset]);
			setSelectedPresetId(result.preset.id);
		} catch (err) {
			console.error('Failed to save preset:', err);
		}
	}, []);

	const handleDeletePreset = useCallback(async (id: string) => {
		try {
			await HostClient.deletePreset(id);
			setPresets((prev) => prev.filter((p) => p.id !== id));
			if (selectedPresetId === id) {
				setSelectedPresetId(null);
			}
		} catch (err) {
			console.error('Failed to delete preset:', err);
		}
	}, [selectedPresetId]);

	const handleRefresh = useCallback(() => {
		if (state.phase === 'ready') {
			handleRefreshInternal();
		}
	}, [state]);

	const handleToggleSettings = useCallback(() => {
		setShowSettings((prev) => !prev);
	}, []);

	const handleApplySettings = useCallback((newConfig: MemoryViewConfig, target: string) => {
		setConfig(newConfig);
		setShowSettings(false);

		// Update total size in paged memory if changed
		if (state.phase === 'ready' && pagedMemory.state.documentId) {
			pagedMemory.reset(
				pagedMemory.state.documentId,
				pagedMemory.state.baseAddress,
				newConfig.totalSize
			);
		}

		if (target !== currentTarget) {
			handleOpenDocument(target);
		}
	}, [currentTarget, handleOpenDocument, state, pagedMemory]);

	const handleCancelSettings = useCallback(() => {
		setShowSettings(false);
	}, []);

	const handleVisibleRangeChange = useCallback((startOffset: number, endOffset: number) => {
		pagedMemory.loadRange(startOffset, endOffset);
	}, [pagedMemory]);

	// ─────────────────────────────────────────────────────────────────────────
	// Register handlers
	// ─────────────────────────────────────────────────────────────────────────

	const handleSelectRegisterSet = useCallback(async (setId: string) => {
		setSelectedRegisterSetId(setId);
		await HostClient.selectRegisterSet(setId);
		const sessionStatus = 'session' in state ? state.session.status : 'none';
		if (sessionStatus === 'stopped') {
			loadRegisters(setId);
		} else {
			setRegistersStale(true);
		}
	}, [state]);

	const handleRefreshRegisters = useCallback(() => {
		const sessionStatus = 'session' in state ? state.session.status : 'none';
		if (sessionStatus === 'stopped') {
			loadRegisters(selectedRegisterSetId);
		} else {
			setRegistersStale(true);
		}
	}, [state, selectedRegisterSetId]);

	const handleEditRegisterSet = useCallback((set: RegisterSetSnapshot) => {
		setEditingRegisterSet(set);
	}, []);

	const handleCreateRegisterSet = useCallback(() => {
		setEditingRegisterSet('new');
	}, []);

	const handleDeleteRegisterSet = useCallback(async (setId: string) => {
		try {
			await HostClient.deleteRegisterSet(setId);
			const remaining = registerSets.filter((s) => s.id !== setId);
			setRegisterSets(remaining);
			// If deleted set was selected, switch to first available
			if (selectedRegisterSetId === setId) {
				const firstSet = remaining[0];
				if (firstSet) {
					setSelectedRegisterSetId(firstSet.id);
					await HostClient.selectRegisterSet(firstSet.id);
					const sessionStatus = 'session' in state ? state.session.status : 'none';
					if (sessionStatus === 'stopped') {
						loadRegisters(firstSet.id);
					} else {
						setRegistersStale(true);
					}
				}
			}
		} catch (err) {
			console.error('Failed to delete register set:', err);
		}
	}, [selectedRegisterSetId, registerSets, state]);

	const handleSaveRegisterSet = useCallback(
		async (name: string, registers: RegisterItemSnapshot[], description?: string) => {
			try {
				if (editingRegisterSet === 'new') {
					const result = await HostClient.saveRegisterSet(name, registers, description);
					setRegisterSets((prev) => [...prev, result.registerSet]);
					setSelectedRegisterSetId(result.registerSet.id);
					await HostClient.selectRegisterSet(result.registerSet.id);
					const sessionStatus = 'session' in state ? state.session.status : 'none';
					if (sessionStatus === 'stopped') {
						loadRegisters(result.registerSet.id);
					} else {
						setRegistersStale(true);
					}
				} else if (editingRegisterSet) {
					const result = await HostClient.updateRegisterSet(editingRegisterSet.id, {
						name,
						registers,
						description,
					});
					if (result.registerSet) {
						setRegisterSets((prev) =>
							prev.map((s) => (s.id === result.registerSet!.id ? result.registerSet! : s))
						);
						const sessionStatus = 'session' in state ? state.session.status : 'none';
						if (sessionStatus === 'stopped' && selectedRegisterSetId === editingRegisterSet.id) {
							loadRegisters(editingRegisterSet.id);
						} else {
							setRegistersStale(true);
						}
					}
				}
				setEditingRegisterSet(null);
			} catch (err) {
				console.error('Failed to save register set:', err);
			}
		},
		[editingRegisterSet, state, selectedRegisterSetId]
	);

	const handleCancelRegisterSetEditor = useCallback(() => {
		setEditingRegisterSet(null);
	}, []);

	const handleToggleRegisterPanel = useCallback(() => {
		setShowRegisterPanel((prev) => !prev);
	}, []);

	const handleRegisterValueFormatChange = useCallback((format: RegisterValueFormat) => {
		setRegisterValueFormat(format);
	}, []);

	const handleRegisterResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
		const container = splitContainerRef.current;
		if (!container) {
			return;
		}

		event.preventDefault();
		setIsResizingRegisterPanel(true);

		const handlePointerMove = (moveEvent: PointerEvent) => {
			const rect = container.getBoundingClientRect();
			const nextWidth = rect.right - moveEvent.clientX;
			setRegisterPanelWidth(clampRegisterPanelWidth(nextWidth, rect.width));
		};

		const handlePointerEnd = () => {
			setIsResizingRegisterPanel(false);
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerEnd);
			window.removeEventListener('pointercancel', handlePointerEnd);
		};

		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', handlePointerEnd);
		window.addEventListener('pointercancel', handlePointerEnd);
	}, []);

	const sessionStatus = 'session' in state ? state.session.status : 'none';
	const isLoading = state.phase === 'loading' || state.phase === 'opening-document' || pagedMemory.isLoading;
	const changedByteCount = getChangedByteCount(changedBytes);

	return (
		<div style={styles.container}>
			<Toolbar
				sessionStatus={sessionStatus}
				presets={presets}
				selectedPresetId={selectedPresetId}
				onOpenDocument={handleOpenDocument}
				onSelectPreset={handleSelectPreset}
				onSavePreset={handleSavePreset}
				onDeletePreset={handleDeletePreset}
				onRefresh={handleRefresh}
				onToggleSettings={handleToggleSettings}
				isLoading={isLoading}
				showSettings={showSettings}
				currentTarget={currentTarget}
			/>
			{showSettings && (
				<SettingsPanel
					config={config}
					currentTarget={currentTarget}
					onApply={handleApplySettings}
					onCancel={handleCancelSettings}
					disabled={sessionStatus !== 'stopped'}
				/>
			)}
			<div
				ref={splitContainerRef}
				style={{
					...styles.mainContent,
					cursor: isResizingRegisterPanel ? 'col-resize' : 'default',
					userSelect: isResizingRegisterPanel ? 'none' : 'auto',
				}}
			>
				{/* Memory content */}
				<div style={styles.content}>
					{renderContent(state, config, pagedMemory, handleVisibleRangeChange, changedBytes)}
				</div>
				{showRegisterPanel ? (
					<>
						<div
							style={styles.registerResizeHandle}
							onPointerDown={handleRegisterResizeStart}
							role="separator"
							aria-orientation="vertical"
							aria-label="Resize register panel"
						/>
						<div
							style={{
								...styles.registerPanelContainer,
								width: registerPanelWidth,
							}}
						>
							<div style={styles.registerPanelHeader}>
								<span style={styles.registerPanelTitle}>Registers</span>
								<button
									onClick={handleToggleRegisterPanel}
									style={styles.collapseButton}
									title="Hide registers"
								>
									<ChevronRightIcon />
								</button>
							</div>
							<RegisterPanel
								registerSets={registerSets}
								selectedSetId={selectedRegisterSetId}
								registerValues={registerValues}
								isStale={registersStale}
								isLoading={registersLoading}
								sessionStatus={sessionStatus}
								valueFormat={registerValueFormat}
								onSelectSet={handleSelectRegisterSet}
								onValueFormatChange={handleRegisterValueFormatChange}
								onRefresh={handleRefreshRegisters}
								onEditSet={handleEditRegisterSet}
								onCreateSet={handleCreateRegisterSet}
								onDeleteSet={handleDeleteRegisterSet}
							/>
						</div>
					</>
				) : (
					<button
						onClick={handleToggleRegisterPanel}
						style={styles.expandSideTab}
						title="Show registers"
					>
						<ChevronLeftIcon />
						<span style={styles.expandSideTabLabel}>Registers</span>
					</button>
				)}
			</div>
			<StatusBar
				status={sessionStatus}
				sessionId={'session' in state ? state.session.sessionId : null}
				documentAddress={'document' in state && state.document ? state.document.address : null}
				error={state.phase === 'error' ? state.error : null}
				changedByteCount={changedByteCount}
			/>
			{/* Register set editor modal */}
			{editingRegisterSet !== null && (
				<RegisterSetEditor
					editingSet={editingRegisterSet === 'new' ? null : editingRegisterSet}
					onSave={handleSaveRegisterSet}
					onCancel={handleCancelRegisterSetEditor}
				/>
			)}
		</div>
	);
}

function renderContent(
	state: AppState,
	config: MemoryViewConfig,
	pagedMemory: ReturnType<typeof usePagedMemory>,
	onVisibleRangeChange: (start: number, end: number) => void,
	changedBytes: ByteChangeMap
): JSX.Element {
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

		case 'ready':
			if (state.session.status !== 'stopped') {
				return (
					<Message>
						Debug session is running.
						<br />
						Pause execution to read memory.
					</Message>
				);
			}
			return (
				<VirtualMemoryGrid
					baseAddress={pagedMemory.state.baseAddress}
					totalSize={config.totalSize}
					getBytes={pagedMemory.getBytes}
					onVisibleRangeChange={onVisibleRangeChange}
					columns={config.columns}
					unitSize={config.unitSize}
					endianness={config.endianness}
					numberFormat={config.numberFormat}
					decodedMode={config.decodedMode}
					changedBytes={changedBytes}
				/>
			);

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

function ChevronLeftIcon(): JSX.Element {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M9.5 13L5 8.5l4.5-4.5.7.7L6.4 8.5l3.8 3.8-.7.7z" />
		</svg>
	);
}

function ChevronRightIcon(): JSX.Element {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M10.5 8L6 3.5l.7-.7 5 5-5 5-.7-.7L10.5 8z" />
		</svg>
	);
}

const styles: Record<string, React.CSSProperties> = {
	container: {
		display: 'flex',
		flexDirection: 'column',
		height: '100vh',
	},
	mainContent: {
		flex: 1,
		display: 'flex',
		flexDirection: 'row',
		overflow: 'hidden',
		minHeight: 0,
	},
	registerPanelContainer: {
		display: 'flex',
		flexDirection: 'column',
		minWidth: 0,
		minHeight: 0,
		borderLeft: '1px solid var(--vscode-widget-border)',
		backgroundColor: 'var(--vscode-editor-background)',
	},
	registerPanelHeader: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '4px 8px',
		backgroundColor: 'var(--vscode-sideBarSectionHeader-background)',
		borderBottom: '1px solid var(--vscode-widget-border)',
	},
	registerResizeHandle: {
		width: '6px',
		cursor: 'col-resize',
		backgroundColor: 'transparent',
		borderLeft: '1px solid transparent',
		borderRight: '1px solid transparent',
	},
	registerPanelTitle: {
		fontSize: '11px',
		fontWeight: 600,
		textTransform: 'uppercase' as const,
		color: 'var(--vscode-sideBarSectionHeader-foreground)',
	},
	collapseButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '20px',
		height: '20px',
		padding: 0,
		border: 'none',
		backgroundColor: 'transparent',
		color: 'var(--vscode-foreground)',
		cursor: 'pointer',
	},
	expandSideTab: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '4px',
		width: '30px',
		padding: '8px 4px',
		border: 'none',
		borderLeft: '1px solid var(--vscode-widget-border)',
		backgroundColor: 'var(--vscode-sideBarSectionHeader-background)',
		color: 'var(--vscode-sideBarSectionHeader-foreground)',
		cursor: 'pointer',
		fontSize: '11px',
		fontWeight: 600,
		textTransform: 'uppercase' as const,
		writingMode: 'vertical-rl',
		textOrientation: 'mixed',
	},
	expandSideTabLabel: {
		letterSpacing: '0.08em',
	},
	content: {
		flex: 1,
		overflow: 'hidden',
		minWidth: 0,
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

function clampRegisterPanelWidth(width: number, containerWidth: number): number {
	const maxWidth = Math.max(MIN_REGISTER_PANEL_WIDTH_FALLBACK, Math.floor(containerWidth * MAX_REGISTER_PANEL_RATIO));
	const minWidth = Math.min(MIN_REGISTER_PANEL_WIDTH, maxWidth);
	return Math.min(Math.max(width, minWidth), maxWidth);
}
