import { useState, useEffect, useCallback, useRef } from 'react';
import { HostClient } from './rpc/HostClient.js';
import { messageBus } from './rpc/WebviewMessageBus.js';
import { VirtualMemoryGrid, type MemorySelection } from './components/VirtualMemoryGrid.js';
import { StatusBar } from './components/StatusBar.js';
import { Toolbar } from './components/Toolbar.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { usePagedMemory } from './hooks/usePagedMemory.js';
import { useMemoryViewStatePersistence } from './hooks/useMemoryViewStatePersistence.js';
import { useMemoryEditing } from './hooks/useMemoryEditing.js';
import { MemoryEditDialog } from './components/MemoryEditDialog.js';
import {
	captureBaselineFromPages,
	refreshAndDiffPages,
	getChangedByteCount,
	type ByteChangeMap,
} from './changeTracking.js';
import type {
	SessionSnapshot,
	DocumentSnapshot,
	PresetSnapshot,
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
	const [memoryWriteSupported, setMemoryWriteSupported] = useState(false);

	const [viewStateReady, setViewStateReady] = useState(false);
	const configRef = useRef(config);
	const pendingRestoreTargetRef = useRef<string | null>(null);
	const restoreAttemptSessionIdRef = useRef<string | null>(null);
	const selectedStackSelectionKeyRef = useRef<string | null>(null);
	const processedStackSelectionVersionRef = useRef(0);

	// Paged memory state
	const pagedMemory = usePagedMemory();

	// Track previous data for change highlighting
	const [changedBytes, setChangedBytes] = useState<ByteChangeMap>(new Map());
	const [memorySelection, setMemorySelection] = useState<MemorySelection | null>(null);
	const baselineRef = useRef<Map<number, number | null>>(new Map());

	// Track if we need to refresh on next stopped event
	const pendingRefreshRef = useRef(false);
	const [stackSelectionVersion, setStackSelectionVersion] = useState(0);
	const editingDocument = state.phase === 'ready' ? state.document : null;
	const editingSession = 'session' in state ? state.session : null;
	const memoryEditing = useMemoryEditing({
		document: editingDocument,
		session: editingSession,
		pagedMemory,
		setChangedBytes,
	});

	useEffect(() => {
		configRef.current = config;
	}, [config]);

	useEffect(() => {
		// Subscribe to session changes
		const unsubSession = messageBus.on('sessionChanged', (payload) => {
			setMemoryWriteSupported(payload.memoryWriteSupported);
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
						return { ...prev, session: payload.session };
					}
				}

				// When transitioning to running, save baseline for change detection
				if (payload.session.status === 'running' && prev.phase === 'ready') {
					baselineRef.current = captureBaselineFromPages(pagedMemory.state.pages);
					setChangedBytes(new Map());
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
					setMemorySelection(null);
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
						payload.document.config.totalSize
					);
					setConfig(payload.document.config);
					baselineRef.current = new Map();
					setChangedBytes(new Map());
					setMemorySelection(null);
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

		const unsubCallStack = messageBus.on('callStackChanged', (payload) => {
			const nextSelectionKey =
				payload.selection.threadId !== null && payload.selection.frameId !== null
					? `${payload.selection.threadId}:${payload.selection.frameId}`
					: null;
			if (selectedStackSelectionKeyRef.current !== nextSelectionKey) {
				selectedStackSelectionKeyRef.current = nextSelectionKey;
				setStackSelectionVersion((prev) => prev + 1);
			}
		});

		// Initialize
		init();

		return () => {
			unsubSession();
			unsubDoc();
			unsubCallStack();
		};
	}, []);

	useMemoryViewStatePersistence(viewStateReady, currentTarget, config, showSettings);

	useEffect(() => {
		if (selectedPresetId && !presets.some((preset) => preset.id === selectedPresetId)) {
			setSelectedPresetId(null);
		}
	}, [presets, selectedPresetId]);

	// Handle pending refresh when stopped
	useEffect(() => {
		if (pendingRefreshRef.current && state.phase === 'ready' && state.session.status === 'stopped') {
			pendingRefreshRef.current = false;
			handleRefreshInternal();
		}
	}, [state]);

	useEffect(() => {
		const sessionStatus = 'session' in state ? state.session.status : 'none';
		if (
			stackSelectionVersion === 0 ||
			stackSelectionVersion === processedStackSelectionVersionRef.current ||
			sessionStatus !== 'stopped'
		) {
			return;
		}

		processedStackSelectionVersionRef.current = stackSelectionVersion;

		if (state.phase === 'ready') {
			void handleRefreshInternal();
		}
	}, [stackSelectionVersion, state]);

	async function init(): Promise<void> {
		try {
			const result = await HostClient.init();
			const restoredViewState = result.viewState;
			const restoredConfig = result.activeDocument?.config ?? restoredViewState?.config ?? DEFAULT_CONFIG;
			const restoredTarget = result.activeDocument?.address ?? restoredViewState?.currentTarget ?? '';

			// Store presets from init
			setPresets(result.presets);
			setMemoryWriteSupported(result.memoryWriteSupported);

			setConfig(restoredConfig);
			setShowSettings(restoredViewState?.showSettings ?? false);
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
				return;
			}

			pendingRestoreTargetRef.current = null;

			// Initialize paged memory
			pagedMemory.reset(
				result.activeDocument.id,
				result.activeDocument.address,
				result.activeDocument.config.totalSize
			);

			setState({
				phase: 'ready',
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

	/** Internal refresh that compares with baseline for highlighting */
	async function handleRefreshInternal(): Promise<void> {
		if (state.phase !== 'ready') return;

		setChangedBytes(
			await refreshAndDiffPages(
				pagedMemory.refreshAll,
				baselineRef.current,
				Date.now()
			)
		);

	}

	const handleOpenDocument = useCallback(async (
		target: string,
		options?: { preservePendingRestore?: boolean; displayName?: string; config?: MemoryViewConfig }
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
			const result = await HostClient.openDocument(target, {
				displayName: options?.displayName ?? target,
				config: options?.config ?? config,
			});
			setConfig(result.document.config);

			// Reset paged memory for new document
			pagedMemory.reset(
				result.document.id,
				result.document.address,
				result.document.config.totalSize
			);

			// Clear change tracking
			baselineRef.current = new Map();
			setChangedBytes(new Map());
			setMemorySelection(null);

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
	}, [config, pagedMemory]);

	const handleCopySelection = useCallback(() => {
		if (!memorySelection) {
			return;
		}
		const count = memorySelection.endOffset - memorySelection.startOffset + 1;
		const bytes = pagedMemory.getBytes(memorySelection.startOffset, count);
		if (!bytes) {
			console.warn('Selected bytes are not loaded yet.');
			return;
		}
		void copyTextToClipboard(formatByteDump(
			pagedMemory.state.baseAddress,
			memorySelection.startOffset,
			bytes
		));
	}, [memorySelection, pagedMemory]);

	const handleCopyLoaded = useCallback(() => {
		const chunks = Array.from(pagedMemory.state.pages.values())
			.sort((a, b) => a.offset - b.offset)
			.map((page) => {
				const remaining = Math.max(0, pagedMemory.state.totalSize - page.offset);
				return formatByteDump(
					pagedMemory.state.baseAddress,
					page.offset,
					page.data.slice(0, remaining)
				);
			})
			.filter(Boolean);
		if (chunks.length === 0) {
			return;
		}
		void copyTextToClipboard(chunks.join('\n'));
	}, [pagedMemory.state.baseAddress, pagedMemory.state.pages, pagedMemory.state.totalSize]);

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
			setCurrentTarget(preset.target);
			void handleOpenDocument(preset.target).then((success) => {
				if (success) {
					setSelectedPresetId(preset.id);
				}
			});
		} else {
			setSelectedPresetId(null);
		}
	}, [handleOpenDocument]);

	const handleSavePreset = useCallback(async (name: string, target: string) => {
		try {
			const result = await HostClient.savePreset(name, target);
			setPresets((prev) => {
				const exists = prev.some((preset) => preset.id === result.preset.id);
				return exists
					? prev.map((preset) => preset.id === result.preset.id ? result.preset : preset)
					: [...prev, result.preset];
			});
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

	const handleApplySettings = useCallback((newConfig: MemoryViewConfig, target: string, displayName: string) => {
		setConfig(newConfig);
		setShowSettings(false);

		if (state.phase === 'ready') {
			if (target !== currentTarget) {
				void handleOpenDocument(target, { displayName, config: newConfig });
				return;
			}

			void HostClient.updateDocument(state.document.id, {
				displayName,
				config: newConfig,
			}).then((result) => {
				setState((prev) => {
					if (prev.phase === 'ready' && prev.document.id === result.document.id) {
						return { ...prev, document: result.document };
					}
					return prev;
				});
			}).catch((err) => {
				console.error('Failed to update document settings:', err);
			});

			pagedMemory.reset(
				state.document.id,
				pagedMemory.state.baseAddress,
				newConfig.totalSize
			);
		}
	}, [currentTarget, handleOpenDocument, state, pagedMemory]);

	const handleCancelSettings = useCallback(() => {
		setShowSettings(false);
	}, []);

	const handleVisibleRangeChange = useCallback((startOffset: number, endOffset: number) => {
		pagedMemory.loadRange(startOffset, endOffset);
	}, [pagedMemory]);

	const sessionStatus = 'session' in state ? state.session.status : 'none';
	const isLoading = state.phase === 'loading' || state.phase === 'opening-document' || pagedMemory.isLoading;
	const changedByteCount = getChangedByteCount(changedBytes);
	const activeDocument = state.phase === 'ready' ? state.document : null;
	const canUndoMemoryWrite = memoryEditing.canUndo;
	const selectedByteCount = memorySelection
		? memorySelection.endOffset - memorySelection.startOffset + 1
		: 0;

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
				onCopySelection={handleCopySelection}
				onCopyLoaded={handleCopyLoaded}
				onUndoMemoryWrite={() => void memoryEditing.undo()}
				canUndoMemoryWrite={canUndoMemoryWrite}
				onToggleSettings={handleToggleSettings}
				isLoading={isLoading}
				showSettings={showSettings}
				currentTarget={currentTarget}
				hasActiveDocument={activeDocument !== null}
				selectedByteCount={selectedByteCount}
			/>
			{showSettings && (
				<SettingsPanel
					config={config}
					currentTarget={currentTarget}
					currentDisplayName={activeDocument?.displayName ?? currentTarget}
					onApply={handleApplySettings}
					onCancel={handleCancelSettings}
					disabled={sessionStatus !== 'stopped'}
				/>
			)}
			<div style={styles.mainContent}>
				<div style={styles.content}>
					{renderContent(
						state,
						config,
						pagedMemory,
						handleVisibleRangeChange,
						changedBytes,
						memorySelection,
						setMemorySelection,
						memoryWriteSupported && sessionStatus === 'stopped' && !memoryEditing.isMutating,
						memoryEditing.beginEdit
					)}
				</div>
			</div>
			{memoryEditing.edit && (
				<MemoryEditDialog
					address={formatDumpAddress(parseAddress(pagedMemory.state.baseAddress) + BigInt(memoryEditing.edit.offset))}
					offset={memoryEditing.edit.offset}
					initialBytes={memoryEditing.edit.oldBytes}
					initialFormat={config.numberFormat}
					bytes={memoryEditing.edit.oldBytes.length}
					endianness={config.endianness}
					error={memoryEditing.editError}
					isSubmitting={memoryEditing.isMutating}
					onCancel={memoryEditing.cancelEdit}
					onConfirm={(data) => void memoryEditing.submitEdit(data)}
				/>
			)}
			<StatusBar
				status={sessionStatus}
				sessionId={'session' in state ? state.session.sessionId : null}
				documentAddress={'document' in state && state.document ? state.document.address : null}
				error={state.phase === 'error' ? state.error : memoryEditing.actionError}
				changedByteCount={changedByteCount}
			/>
		</div>
	);
}

function renderContent(
	state: AppState,
	config: MemoryViewConfig,
	pagedMemory: ReturnType<typeof usePagedMemory>,
	onVisibleRangeChange: (start: number, end: number) => void,
	changedBytes: ByteChangeMap,
	memorySelection: MemorySelection | null,
	onSelectionChange: (selection: MemorySelection | null) => void,
	canEditMemory: boolean,
	onEditCell: (offset: number, bytes: number[]) => void
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
					selection={memorySelection}
					onSelectionChange={onSelectionChange}
					canEditMemory={canEditMemory}
					onEditCell={onEditCell}
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

async function copyTextToClipboard(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
	} catch (err) {
		console.error('Failed to copy memory bytes:', err);
	}
}

function formatByteDump(
	baseAddress: string,
	startOffset: number,
	bytes: (number | null)[]
): string {
	const base = parseAddress(baseAddress);
	const lines: string[] = [];
	const bytesPerLine = 16;

	for (let index = 0; index < bytes.length; index += bytesPerLine) {
		const lineOffset = startOffset + index;
		const address = base + BigInt(lineOffset);
		const chunk = bytes.slice(index, index + bytesPerLine);
		const values = chunk.map((byte) => byte === null
			? '~~'
			: byte.toString(16).toUpperCase().padStart(2, '0'));
		lines.push(`${formatDumpAddress(address)}  ${values.join(' ')}`);
	}

	return lines.join('\n');
}

function parseAddress(address: string): bigint {
	try {
		return BigInt(address);
	} catch {
		return 0n;
	}
}

function formatDumpAddress(address: bigint): string {
	return '0x' + address.toString(16).padStart(16, '0').toUpperCase();
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
