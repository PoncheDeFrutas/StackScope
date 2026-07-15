import { useCallback, useEffect, useRef, useState } from 'react';
import type {
	RegisterItemSnapshot,
	RegisterSetSnapshot,
	RegisterValueSnapshot,
	SessionSnapshot,
	WatchpointSnapshot,
	WatchpointSupportSnapshot,
	WatchpointTarget,
} from '../protocol/methods.js';
import { RegisterPanel, type RegisterValueFormat } from './components/RegisterPanel.js';
import { RegisterSetEditor } from './components/RegisterSetEditor.js';
import { RegisterEditDialog } from './components/RegisterEditDialog.js';
import { WatchpointDialog } from './components/WatchpointDialog.js';
import { WatchpointsPanel } from './components/WatchpointsPanel.js';
import { ExplorerSection } from './components/ExplorerSection.js';
import { useWatchpointDialog } from './hooks/useWatchpointDialog.js';
import type { Endianness } from '../domain/config/MemoryViewConfig.js';
import { LoadGeneration } from './hooks/LoadGeneration.js';
import { HostClient } from './rpc/HostClient.js';
import { messageBus } from './rpc/WebviewMessageBus.js';

const INITIAL_SESSION: SessionSnapshot = { sessionId: null, status: 'none' };

export function RegistersApp(): JSX.Element {
	const [session, setSession] = useState<SessionSnapshot>(INITIAL_SESSION);
	const [registerSets, setRegisterSets] = useState<RegisterSetSnapshot[]>([]);
	const [selectedSetId, setSelectedSetId] = useState('builtin-core');
	const [registerValues, setRegisterValues] = useState<RegisterValueSnapshot[]>([]);
	const [isStale, setIsStale] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [valueFormat, setValueFormat] = useState<RegisterValueFormat>('hex');
	const [editingSet, setEditingSet] = useState<RegisterSetSnapshot | null | 'new'>(null);
	const [registerWriteSupported, setRegisterWriteSupported] = useState(false);
	const [editingRegister, setEditingRegister] = useState<RegisterValueSnapshot | null>(null);
	const [registerEditError, setRegisterEditError] = useState<string | null>(null);
	const [isWritingRegister, setIsWritingRegister] = useState(false);
	const [memoryEndianness, setMemoryEndianness] = useState<Endianness>('little');
	const [watchpointSupport, setWatchpointSupport] = useState<WatchpointSupportSnapshot>({ dataBreakpoints: false, memoryRanges: false, gdbRegisterFallback: false });
	const [watchpoints, setWatchpoints] = useState<WatchpointSnapshot[]>([]);
	const [registersExpanded, setRegistersExpanded] = useState(true);
	const [watchpointsExpanded, setWatchpointsExpanded] = useState(false);
	const [hitWatchpointIds, setHitWatchpointIds] = useState<string[]>([]);
	const selectedSetIdRef = useRef(selectedSetId);
	const sessionRef = useRef(session);
	const mountedRef = useRef(false);
	const initializeGenerationRef = useRef(new LoadGeneration());
	const loadGenerationRef = useRef(new LoadGeneration());

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			initializeGenerationRef.current.invalidate();
			loadGenerationRef.current.invalidate();
		};
	}, []);

	useEffect(() => {
		selectedSetIdRef.current = selectedSetId;
	}, [selectedSetId]);

	useEffect(() => {
		sessionRef.current = session;
	}, [session]);

	const loadRegisters = useCallback(async (setId: string): Promise<void> => {
		const generation = loadGenerationRef.current.advance();
		setIsLoading(true);
		try {
			const result = await HostClient.readRegisters(setId);
			if (!mountedRef.current || !loadGenerationRef.current.isCurrent(generation)) {
				return;
			}
			setRegisterValues(result.values);
			setIsStale(false);
		} catch (error) {
			if (!mountedRef.current || !loadGenerationRef.current.isCurrent(generation)) {
				return;
			}
			console.error('Failed to load registers:', error);
			setIsStale(true);
		} finally {
			if (mountedRef.current && loadGenerationRef.current.isCurrent(generation)) {
				setIsLoading(false);
			}
		}
	}, []);

	const initialize = useCallback(async (): Promise<void> => {
		const generation = initializeGenerationRef.current.advance();
		try {
			const result = await HostClient.init();
			if (!mountedRef.current || !initializeGenerationRef.current.isCurrent(generation)) {
				return;
			}
			sessionRef.current = result.session;
			selectedSetIdRef.current = result.selectedRegisterSetId;
			setSession(result.session);
			setRegisterSets(result.registerSets);
			setSelectedSetId(result.selectedRegisterSetId);
			setValueFormat(result.viewState?.registerValueFormat ?? 'hex');
			setMemoryEndianness(result.viewState?.config.endianness ?? 'little');
			setRegisterWriteSupported(result.registerWriteSupported);
			setWatchpointSupport(result.watchpointSupport);
			setWatchpoints(result.watchpoints);
			setRegistersExpanded(result.viewState?.registersExpanded ?? true);
			setWatchpointsExpanded(result.viewState?.watchpointsExpanded ?? false);
			if (result.session.status === 'stopped') {
				await loadRegisters(result.selectedRegisterSetId);
			}
		} catch (error) {
			if (!mountedRef.current || !initializeGenerationRef.current.isCurrent(generation)) {
				return;
			}
			console.error('Failed to initialize registers:', error);
			setIsStale(true);
		}
	}, [loadRegisters]);

	useEffect(() => {
		void initialize();
		const unsubscribeSession = messageBus.on('sessionChanged', (payload) => {
			initializeGenerationRef.current.invalidate();
			sessionRef.current = payload.session;
			setSession(payload.session);
			setRegisterWriteSupported(payload.registerWriteSupported);
			setWatchpointSupport(payload.watchpointSupport);
			if (payload.session.status === 'stopped') {
				void loadRegisters(selectedSetIdRef.current);
			} else {
				loadGenerationRef.current.invalidate();
				setIsLoading(false);
				setIsStale(true);
			}
		});
		const unsubscribeCallStack = messageBus.on('callStackChanged', () => {
			if (sessionRef.current.status === 'stopped') {
				void loadRegisters(selectedSetIdRef.current);
			}
		});
		const unsubscribeDocument = messageBus.on('documentChanged', (payload) => {
			if (payload.document) {
				setMemoryEndianness(payload.document.config.endianness);
			}
		});
		const unsubscribeWatchpoints = messageBus.on('watchpointsChanged', (payload) => setWatchpoints(payload.watchpoints));
		const unsubscribeWatchpointHit = messageBus.on('watchpointHit', (payload) => {
			setHitWatchpointIds(payload.watchpointIds);
		});

		return () => {
			unsubscribeSession();
			unsubscribeCallStack();
			unsubscribeDocument();
			unsubscribeWatchpoints();
			unsubscribeWatchpointHit();
		};
	}, [initialize, loadRegisters]);

	const handleSelectSet = useCallback(
		async (setId: string) => {
			loadGenerationRef.current.invalidate();
			selectedSetIdRef.current = setId;
			setSelectedSetId(setId);
			try {
				await HostClient.selectRegisterSet(setId);
				if (sessionRef.current.status === 'stopped') {
					await loadRegisters(setId);
				} else {
					setIsStale(true);
				}
			} catch (error) {
				console.error('Failed to select register set:', error);
				setIsStale(true);
			}
		},
		[loadRegisters]
	);

	const handleRefresh = useCallback(() => {
		if (sessionRef.current.status === 'stopped') {
			void loadRegisters(selectedSetIdRef.current);
		} else {
			setIsStale(true);
		}
	}, [loadRegisters]);

	const handleValueFormatChange = useCallback((format: RegisterValueFormat) => {
		setValueFormat(format);
		void HostClient.saveRegisterViewState(format).catch((error) => {
			console.error('Failed to save register view state:', error);
		});
	}, []);

	const handleEditRegister = useCallback((register: RegisterValueSnapshot) => {
		if (sessionRef.current.status !== 'stopped' || register.value === null || isWritingRegister) return;
		setEditingRegister(register);
		setRegisterEditError(null);
	}, [isWritingRegister]);

	const saveSections = useCallback((nextRegisters: boolean, nextWatchpoints: boolean) => {
		void HostClient.saveRegisterViewState(valueFormat, { registersExpanded: nextRegisters, watchpointsExpanded: nextWatchpoints });
	}, [valueFormat]);

	const handleRegistersExpandedChange = useCallback((expanded: boolean) => {
		setRegistersExpanded(expanded);
		saveSections(expanded, watchpointsExpanded);
	}, [saveSections, watchpointsExpanded]);

	const handleWatchpointsExpandedChange = useCallback((expanded: boolean) => {
		setWatchpointsExpanded(expanded);
		saveSections(registersExpanded, expanded);
	}, [registersExpanded, saveSections]);

	useEffect(() => {
		if (hitWatchpointIds.length > 0) {
			handleWatchpointsExpandedChange(true);
		}
	}, [handleWatchpointsExpandedChange, hitWatchpointIds]);

	const handleWatchpointCreated = useCallback((watchpoint: WatchpointSnapshot) => {
		setWatchpoints((previous) => previous.some((item) => item.id === watchpoint.id)
			? previous.map((item) => item.id === watchpoint.id ? watchpoint : item)
			: [...previous, watchpoint]);
		handleWatchpointsExpandedChange(true);
	}, [handleWatchpointsExpandedChange]);

	const watchpointDialog = useWatchpointDialog(handleWatchpointCreated);

	const handleAddWatchpoint = useCallback(async (register: RegisterValueSnapshot) => {
		if (register.value === null || sessionRef.current.status !== 'stopped') return;
		const target: WatchpointTarget = { kind: 'register', expression: register.expression, label: register.label };
		if (!await watchpointDialog.prepare(target)) {
			handleWatchpointsExpandedChange(true);
		}
	}, [handleWatchpointsExpandedChange, watchpointDialog]);

	const handleRemoveWatchpoint = useCallback((id: string) => {
		void HostClient.removeWatchpoint(id).catch((error) => watchpointDialog.setError(error instanceof Error ? error.message : 'Failed to remove watchpoint'));
	}, [watchpointDialog]);

	const handleConfirmRegisterEdit = useCallback(async (value: string) => {
		if (!editingRegister || isWritingRegister) return;
		setIsWritingRegister(true);
		setRegisterEditError(null);
		try {
			const result = await HostClient.writeRegister(editingRegister.expression, value);
			if (!result.readBackAvailable) {
				setRegisterEditError('The debugger accepted the write but could not read the register back.');
				return;
			}
			await loadRegisters(selectedSetIdRef.current);
			setEditingRegister(null);
		} catch (error) {
			console.error('Failed to write register:', error);
			setRegisterEditError(error instanceof Error ? error.message : 'Failed to write register');
		} finally {
			setIsWritingRegister(false);
		}
	}, [editingRegister, isWritingRegister, loadRegisters]);

	const handleDeleteSet = useCallback(
		async (setId: string) => {
			try {
				await HostClient.deleteRegisterSet(setId);
				const remaining = registerSets.filter((set) => set.id !== setId);
				setRegisterSets(remaining);
				if (selectedSetId === setId && remaining[0]) {
					await handleSelectSet(remaining[0].id);
				}
			} catch (error) {
				console.error('Failed to delete register set:', error);
			}
		},
		[handleSelectSet, registerSets, selectedSetId]
	);

	const handleSaveSet = useCallback(
		async (name: string, registers: RegisterItemSnapshot[], description?: string) => {
			try {
				if (editingSet === 'new') {
					const result = await HostClient.saveRegisterSet(name, registers, description);
					setRegisterSets((previous) => [...previous, result.registerSet]);
					await handleSelectSet(result.registerSet.id);
				} else if (editingSet) {
					const result = await HostClient.updateRegisterSet(editingSet.id, {
						name,
						registers,
						description,
					});
					if (result.registerSet) {
						setRegisterSets((previous) =>
							previous.map((set) =>
								set.id === result.registerSet!.id ? result.registerSet! : set
							)
						);
						if (selectedSetIdRef.current === result.registerSet.id) {
							handleRefresh();
						}
					}
				}
				setEditingSet(null);
			} catch (error) {
				console.error('Failed to save register set:', error);
			}
		},
		[editingSet, handleRefresh, handleSelectSet]
	);

	const watchpointDisabledReason = session.status !== 'stopped'
		? 'Pause execution before setting a watchpoint.'
		: !watchpointSupport.dataBreakpoints && !watchpointSupport.gdbRegisterFallback
			? 'This debugger does not support register watchpoints.'
			: watchpointDialog.isSubmitting ? 'A watchpoint is being configured.' : null;

	return (
		<div style={styles.container}>
			<div style={styles.viewContent}>
			<ExplorerSection id="stackscope-registers" label="REGISTERS" expanded={registersExpanded} onExpandedChange={handleRegistersExpandedChange}>
			<RegisterPanel
				registerSets={registerSets}
				selectedSetId={selectedSetId}
				registerValues={registerValues}
				isStale={isStale}
				isLoading={isLoading}
				sessionStatus={session.status}
				valueFormat={valueFormat}
				onSelectSet={handleSelectSet}
				onValueFormatChange={handleValueFormatChange}
				onRefresh={handleRefresh}
				onEditSet={setEditingSet}
				onCreateSet={() => setEditingSet('new')}
				onDeleteSet={handleDeleteSet}
				canEditRegisters={registerWriteSupported && session.status === 'stopped' && !isWritingRegister}
				onEditRegister={handleEditRegister}
				canWatchRegisters={(watchpointSupport.dataBreakpoints || watchpointSupport.gdbRegisterFallback) && session.status === 'stopped' && !watchpointDialog.isSubmitting}
				watchpointDisabledReason={watchpointDisabledReason}
				onAddWatchpoint={handleAddWatchpoint}
			/>
			</ExplorerSection>
			<ExplorerSection id="stackscope-watchpoints" label="WATCHPOINTS" count={watchpoints.length} expanded={watchpointsExpanded} onExpandedChange={handleWatchpointsExpandedChange}>
				<WatchpointsPanel watchpoints={watchpoints} support={watchpointSupport} hitIds={hitWatchpointIds} error={watchpointDialog.error} onRemove={handleRemoveWatchpoint} />
			</ExplorerSection>
			</div>
			{editingSet !== null && (
				<RegisterSetEditor
					editingSet={editingSet === 'new' ? null : editingSet}
					onSave={handleSaveSet}
					onCancel={() => setEditingSet(null)}
				/>
			)}
			{watchpointDialog.dialog && <WatchpointDialog target={watchpointDialog.dialog.target} backend={watchpointDialog.dialog.backend} description={watchpointDialog.dialog.description} accessTypes={watchpointDialog.dialog.accessTypes} error={watchpointDialog.error} isSubmitting={watchpointDialog.isSubmitting} onCancel={watchpointDialog.cancel} onConfirm={watchpointDialog.confirm} />}
			{editingRegister && editingRegister.value !== null && (
				<RegisterEditDialog
					expression={editingRegister.expression}
					initialValue={editingRegister.value}
					initialFormat={valueFormat}
					endianness={memoryEndianness}
					error={registerEditError}
					isSubmitting={isWritingRegister}
					onCancel={() => !isWritingRegister && setEditingRegister(null)}
					onConfirm={(value) => void handleConfirmRegisterEdit(value)}
				/>
			)}
		</div>
	);
}

const styles = {
	container: {
		display: 'flex',
		flexDirection: 'column' as const,
		height: '100vh',
		minHeight: 0,
		overflow: 'hidden',
	},
	viewContent: { flex: 1, minHeight: 0, overflow: 'auto' },
};
