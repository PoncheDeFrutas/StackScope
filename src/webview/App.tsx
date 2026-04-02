import { useState, useEffect, useCallback, useRef } from 'react';
import { HostClient } from './rpc/HostClient.js';
import { messageBus } from './rpc/WebviewMessageBus.js';
import { VirtualMemoryGrid } from './components/VirtualMemoryGrid.js';
import { StatusBar } from './components/StatusBar.js';
import { Toolbar } from './components/Toolbar.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { RegisterPanel, type RegisterValueFormat } from './components/RegisterPanel.js';
import { RegisterSetEditor } from './components/RegisterSetEditor.js';
import { usePagedMemory } from './hooks/usePagedMemory.js';
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
	const [editingRegisterSet, setEditingRegisterSet] = useState<RegisterSetSnapshot | null | 'new'>(null);

	// Paged memory state
	const pagedMemory = usePagedMemory();

	// Track previous data for change highlighting
	const [changedBytes, setChangedBytes] = useState<Set<number>>(new Set());
	const baselineRef = useRef<Map<number, number | null>>(new Map());

	// Track if we need to refresh on next stopped event
	const pendingRefreshRef = useRef(false);
	const pendingRegisterRefreshRef = useRef(false);

	useEffect(() => {
		// Subscribe to session changes
		const unsubSession = messageBus.on('sessionChanged', (payload) => {
			setState((prev) => {
				if (payload.session.status === 'none' || !payload.session.sessionId) {
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
					// Save current data as baseline
					const baseline = new Map<number, number | null>();
					for (const [offset, page] of pagedMemory.state.pages) {
						page.data.forEach((byte, i) => {
							baseline.set(offset + i, byte);
						});
					}
					baselineRef.current = baseline;
					setChangedBytes(new Set());
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
						config.totalSize
					);
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

			// Store presets from init
			setPresets(result.presets);

			// Store register sets from init
			setRegisterSets(result.registerSets);
			setSelectedRegisterSetId(result.selectedRegisterSetId);

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

			setCurrentTarget(result.activeDocument.address);

			// Initialize paged memory
			pagedMemory.reset(
				result.activeDocument.id,
				result.activeDocument.address,
				config.totalSize
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

		// Compare with baseline for change detection
		const changed = new Set<number>();
		const baseline = baselineRef.current;

		for (const [offset, page] of pagedMemory.state.pages) {
			page.data.forEach((byte, i) => {
				const globalOffset = offset + i;
				const baselineByte = baseline.get(globalOffset);
				if (baselineByte !== undefined && baselineByte !== byte) {
					changed.add(globalOffset);
				}
			});
		}

		setChangedBytes(changed);

		// Also refresh registers
		loadRegisters(selectedRegisterSetId);
	}

	const handleOpenDocument = useCallback(async (target: string) => {
		setCurrentTarget(target);
		setSelectedPresetId(null);
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
			setChangedBytes(new Set());

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
	}, [config.totalSize, pagedMemory]);

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

	const sessionStatus = 'session' in state ? state.session.status : 'none';
	const isLoading = state.phase === 'loading' || state.phase === 'opening-document' || pagedMemory.isLoading;

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
			<div style={styles.mainContent}>
				{/* Register Panel (collapsible) */}
				<div style={{
					...styles.registerPanelContainer,
					display: showRegisterPanel ? 'flex' : 'none',
				}}>
					<div style={styles.registerPanelHeader}>
						<span style={styles.registerPanelTitle}>Registers</span>
						<button
							onClick={handleToggleRegisterPanel}
							style={styles.collapseButton}
							title="Hide registers"
						>
							<ChevronDownIcon />
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
				{/* Collapsed register toggle */}
				{!showRegisterPanel && (
					<button
						onClick={handleToggleRegisterPanel}
						style={styles.expandButton}
						title="Show registers"
					>
						<ChevronRightIcon /> Registers
					</button>
				)}
				{/* Memory content */}
				<div style={styles.content}>
					{renderContent(state, config, pagedMemory, handleVisibleRangeChange, changedBytes)}
				</div>
			</div>
			<StatusBar
				status={sessionStatus}
				sessionId={'session' in state ? state.session.sessionId : null}
				documentAddress={'document' in state && state.document ? state.document.address : null}
				error={state.phase === 'error' ? state.error : null}
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
	changedBytes: Set<number>
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

function ChevronDownIcon(): JSX.Element {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8 11.5L3.5 7l.7-.7L8 10.1l3.8-3.8.7.7L8 11.5z" />
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
		flexDirection: 'column',
		overflow: 'hidden',
	},
	registerPanelContainer: {
		flexDirection: 'column',
		borderBottom: '1px solid var(--vscode-widget-border)',
		maxHeight: '200px',
		minHeight: '100px',
	},
	registerPanelHeader: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '4px 8px',
		backgroundColor: 'var(--vscode-sideBarSectionHeader-background)',
		borderBottom: '1px solid var(--vscode-widget-border)',
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
	expandButton: {
		display: 'flex',
		alignItems: 'center',
		gap: '4px',
		padding: '4px 8px',
		border: 'none',
		backgroundColor: 'var(--vscode-sideBarSectionHeader-background)',
		color: 'var(--vscode-sideBarSectionHeader-foreground)',
		cursor: 'pointer',
		fontSize: '11px',
		fontWeight: 600,
		textTransform: 'uppercase' as const,
		borderBottom: '1px solid var(--vscode-widget-border)',
	},
	content: {
		flex: 1,
		overflow: 'hidden',
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
