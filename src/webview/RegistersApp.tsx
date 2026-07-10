import { useCallback, useEffect, useRef, useState } from 'react';
import type {
	RegisterItemSnapshot,
	RegisterSetSnapshot,
	RegisterValueSnapshot,
	SessionSnapshot,
} from '../protocol/methods.js';
import { RegisterPanel, type RegisterValueFormat } from './components/RegisterPanel.js';
import { RegisterSetEditor } from './components/RegisterSetEditor.js';
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
	const selectedSetIdRef = useRef(selectedSetId);
	const sessionRef = useRef(session);

	useEffect(() => {
		selectedSetIdRef.current = selectedSetId;
	}, [selectedSetId]);

	useEffect(() => {
		sessionRef.current = session;
	}, [session]);

	const loadRegisters = useCallback(async (setId: string): Promise<void> => {
		setIsLoading(true);
		try {
			const result = await HostClient.readRegisters(setId);
			setRegisterValues(result.values);
			setIsStale(false);
		} catch (error) {
			console.error('Failed to load registers:', error);
			setIsStale(true);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const initialize = useCallback(async (): Promise<void> => {
		try {
			const result = await HostClient.init();
			setSession(result.session);
			setRegisterSets(result.registerSets);
			setSelectedSetId(result.selectedRegisterSetId);
			setValueFormat(result.viewState?.registerValueFormat ?? 'hex');
			if (result.session.status === 'stopped') {
				await loadRegisters(result.selectedRegisterSetId);
			}
		} catch (error) {
			console.error('Failed to initialize registers:', error);
			setIsStale(true);
		}
	}, [loadRegisters]);

	useEffect(() => {
		void initialize();
		const unsubscribeSession = messageBus.on('sessionChanged', (payload) => {
			setSession(payload.session);
			if (payload.session.status === 'stopped') {
				void loadRegisters(selectedSetIdRef.current);
			} else {
				setIsStale(true);
			}
		});
		const unsubscribeCallStack = messageBus.on('callStackChanged', () => {
			if (sessionRef.current.status === 'stopped') {
				void loadRegisters(selectedSetIdRef.current);
			}
		});

		return () => {
			unsubscribeSession();
			unsubscribeCallStack();
		};
	}, [initialize, loadRegisters]);

	const handleSelectSet = useCallback(
		async (setId: string) => {
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

	return (
		<div style={styles.container}>
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
			/>
			{editingSet !== null && (
				<RegisterSetEditor
					editingSet={editingSet === 'new' ? null : editingSet}
					onSave={handleSaveSet}
					onCancel={() => setEditingSet(null)}
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
};
