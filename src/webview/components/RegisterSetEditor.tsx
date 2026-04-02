import { useState, useCallback, type CSSProperties, type KeyboardEvent } from 'react';
import type { RegisterItemSnapshot, RegisterSetSnapshot } from '../../protocol/methods.js';

interface RegisterSetEditorProps {
	/** Existing set to edit, or null for creating a new one */
	editingSet: RegisterSetSnapshot | null;
	onSave: (name: string, registers: RegisterItemSnapshot[], description?: string) => void;
	onCancel: () => void;
}

interface EditableRegister {
	id: string;
	expression: string;
	label: string;
}

/**
 * Visual row-by-row editor for register sets.
 */
export function RegisterSetEditor({
	editingSet,
	onSave,
	onCancel,
}: RegisterSetEditorProps): JSX.Element {
	const [name, setName] = useState(editingSet?.name ?? '');
	const [description, setDescription] = useState(editingSet?.description ?? '');
	const [registers, setRegisters] = useState<EditableRegister[]>(() => {
		if (editingSet) {
			return editingSet.registers.map((r, i) => ({
				id: `reg_${i}`,
				expression: r.expression,
				label: r.label ?? '',
			}));
		}
		return [{ id: 'reg_0', expression: '', label: '' }];
	});

	const isValid = name.trim() && registers.some((r) => r.expression.trim());

	const handleAddRegister = useCallback(() => {
		setRegisters((prev) => [
			...prev,
			{ id: `reg_${Date.now()}`, expression: '', label: '' },
		]);
	}, []);

	const handleRemoveRegister = useCallback((id: string) => {
		setRegisters((prev) => {
			if (prev.length <= 1) return prev;
			return prev.filter((r) => r.id !== id);
		});
	}, []);

	const handleRegisterChange = useCallback(
		(id: string, field: 'expression' | 'label', value: string) => {
			setRegisters((prev) =>
				prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
			);
		},
		[]
	);

	const handleMoveUp = useCallback((index: number) => {
		if (index <= 0) return;
		setRegisters((prev) => {
			const newRegs = [...prev];
			[newRegs[index - 1], newRegs[index]] = [newRegs[index], newRegs[index - 1]];
			return newRegs;
		});
	}, []);

	const handleMoveDown = useCallback((index: number) => {
		setRegisters((prev) => {
			if (index >= prev.length - 1) return prev;
			const newRegs = [...prev];
			[newRegs[index], newRegs[index + 1]] = [newRegs[index + 1], newRegs[index]];
			return newRegs;
		});
	}, []);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>, index: number) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				// Add new row and focus it
				handleAddRegister();
				setTimeout(() => {
					const inputs = document.querySelectorAll<HTMLInputElement>(
						'[data-register-expression]'
					);
					inputs[inputs.length - 1]?.focus();
				}, 0);
			} else if (e.key === 'Backspace' && e.currentTarget.value === '') {
				e.preventDefault();
				if (registers.length > 1) {
					handleRemoveRegister(registers[index].id);
					// Focus previous row
					setTimeout(() => {
						const inputs = document.querySelectorAll<HTMLInputElement>(
							'[data-register-expression]'
						);
						const focusIndex = Math.max(0, index - 1);
						inputs[focusIndex]?.focus();
					}, 0);
				}
			}
		},
		[registers, handleAddRegister, handleRemoveRegister]
	);

	const handleSave = useCallback(() => {
		const validRegisters = registers
			.filter((r) => r.expression.trim())
			.map((r) => ({
				expression: r.expression.trim(),
				label: r.label.trim() || undefined,
			}));

		if (name.trim() && validRegisters.length > 0) {
			onSave(name.trim(), validRegisters, description.trim() || undefined);
		}
	}, [name, registers, description, onSave]);

	return (
		<div style={styles.overlay}>
			<div style={styles.editor}>
				<div style={styles.header}>
					<h3 style={styles.title}>
						{editingSet ? 'Edit Register Set' : 'New Register Set'}
					</h3>
					<button onClick={onCancel} style={styles.closeButton} title="Close">
						<CloseIcon />
					</button>
				</div>

				<div style={styles.body}>
					{/* Name input */}
					<div style={styles.field}>
						<label style={styles.label}>Name</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							style={styles.input}
							placeholder="e.g., ARM General Purpose"
							autoFocus
						/>
					</div>

					{/* Description input */}
					<div style={styles.field}>
						<label style={styles.label}>Description (optional)</label>
						<input
							type="text"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							style={styles.input}
							placeholder="e.g., General purpose registers x0-x7"
						/>
					</div>

					{/* Registers list */}
					<div style={styles.field}>
						<label style={styles.label}>Registers</label>
						<div style={styles.registerList}>
							{registers.map((reg, index) => (
								<div key={reg.id} style={styles.registerRow}>
									<div style={styles.rowNumber}>{index + 1}</div>
									<input
										type="text"
										value={reg.expression}
										onChange={(e) =>
											handleRegisterChange(reg.id, 'expression', e.target.value)
										}
										onKeyDown={(e) => handleKeyDown(e, index)}
										style={styles.expressionInput}
										placeholder="$pc, x0, sp..."
										data-register-expression
									/>
									<input
										type="text"
										value={reg.label}
										onChange={(e) =>
											handleRegisterChange(reg.id, 'label', e.target.value)
										}
										style={styles.labelInput}
										placeholder="Label (optional)"
									/>
									<div style={styles.rowActions}>
										<button
											onClick={() => handleMoveUp(index)}
											disabled={index === 0}
											style={styles.rowButton}
											title="Move up"
										>
											<ChevronUpIcon />
										</button>
										<button
											onClick={() => handleMoveDown(index)}
											disabled={index === registers.length - 1}
											style={styles.rowButton}
											title="Move down"
										>
											<ChevronDownIcon />
										</button>
										<button
											onClick={() => handleRemoveRegister(reg.id)}
											disabled={registers.length <= 1}
											style={styles.rowButton}
											title="Remove"
										>
											<RemoveIcon />
										</button>
									</div>
								</div>
							))}
						</div>
						<button onClick={handleAddRegister} style={styles.addButton}>
							<PlusIcon /> Add Register
						</button>
					</div>
				</div>

				<div style={styles.footer}>
					<button onClick={onCancel} style={styles.cancelButton}>
						Cancel
					</button>
					<button
						onClick={handleSave}
						disabled={!isValid}
						style={styles.saveButton}
					>
						{editingSet ? 'Update' : 'Create'}
					</button>
				</div>
			</div>
		</div>
	);
}

// Icons
function CloseIcon(): JSX.Element {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z" />
		</svg>
	);
}

function PlusIcon(): JSX.Element {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z" />
		</svg>
	);
}

function RemoveIcon(): JSX.Element {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M15 8H1V7h14v1z" />
		</svg>
	);
}

function ChevronUpIcon(): JSX.Element {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8 4.5L12.5 9l-.7.7L8 5.9 4.2 9.7l-.7-.7L8 4.5z" />
		</svg>
	);
}

function ChevronDownIcon(): JSX.Element {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8 11.5L3.5 7l.7-.7L8 10.1l3.8-3.8.7.7L8 11.5z" />
		</svg>
	);
}

const styles: Record<string, CSSProperties> = {
	overlay: {
		position: 'fixed',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1000,
	},
	editor: {
		backgroundColor: 'var(--vscode-editor-background)',
		border: '1px solid var(--vscode-widget-border)',
		borderRadius: '6px',
		width: '450px',
		maxWidth: '90vw',
		maxHeight: '80vh',
		display: 'flex',
		flexDirection: 'column',
		boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
	},
	header: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '12px 16px',
		borderBottom: '1px solid var(--vscode-widget-border)',
	},
	title: {
		margin: 0,
		fontSize: '14px',
		fontWeight: 500,
		color: 'var(--vscode-foreground)',
	},
	closeButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '24px',
		height: '24px',
		padding: 0,
		border: 'none',
		backgroundColor: 'transparent',
		color: 'var(--vscode-foreground)',
		cursor: 'pointer',
		borderRadius: '3px',
	},
	body: {
		flex: 1,
		overflow: 'auto',
		padding: '16px',
		display: 'flex',
		flexDirection: 'column',
		gap: '16px',
	},
	field: {
		display: 'flex',
		flexDirection: 'column',
		gap: '6px',
	},
	label: {
		fontSize: '12px',
		color: 'var(--vscode-descriptionForeground)',
		fontWeight: 500,
	},
	input: {
		padding: '6px 10px',
		border: '1px solid var(--vscode-input-border)',
		backgroundColor: 'var(--vscode-input-background)',
		color: 'var(--vscode-input-foreground)',
		fontSize: '13px',
		borderRadius: '2px',
		outline: 'none',
	},
	registerList: {
		display: 'flex',
		flexDirection: 'column',
		gap: '4px',
		maxHeight: '200px',
		overflow: 'auto',
		padding: '4px',
		backgroundColor: 'var(--vscode-input-background)',
		border: '1px solid var(--vscode-input-border)',
		borderRadius: '2px',
	},
	registerRow: {
		display: 'flex',
		alignItems: 'center',
		gap: '4px',
	},
	rowNumber: {
		width: '20px',
		fontSize: '11px',
		color: 'var(--vscode-descriptionForeground)',
		textAlign: 'center',
	},
	expressionInput: {
		flex: 1,
		padding: '4px 8px',
		border: '1px solid var(--vscode-input-border)',
		backgroundColor: 'var(--vscode-editor-background)',
		color: 'var(--vscode-input-foreground)',
		fontSize: '12px',
		fontFamily: 'var(--vscode-editor-font-family)',
		borderRadius: '2px',
		outline: 'none',
	},
	labelInput: {
		width: '100px',
		padding: '4px 8px',
		border: '1px solid var(--vscode-input-border)',
		backgroundColor: 'var(--vscode-editor-background)',
		color: 'var(--vscode-input-foreground)',
		fontSize: '12px',
		borderRadius: '2px',
		outline: 'none',
	},
	rowActions: {
		display: 'flex',
		gap: '2px',
	},
	rowButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '20px',
		height: '20px',
		padding: 0,
		border: 'none',
		backgroundColor: 'transparent',
		color: 'var(--vscode-descriptionForeground)',
		cursor: 'pointer',
		borderRadius: '2px',
	},
	addButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '4px',
		padding: '6px 12px',
		border: '1px dashed var(--vscode-widget-border)',
		backgroundColor: 'transparent',
		color: 'var(--vscode-descriptionForeground)',
		cursor: 'pointer',
		fontSize: '12px',
		borderRadius: '2px',
		marginTop: '4px',
	},
	footer: {
		display: 'flex',
		justifyContent: 'flex-end',
		gap: '8px',
		padding: '12px 16px',
		borderTop: '1px solid var(--vscode-widget-border)',
	},
	cancelButton: {
		padding: '6px 14px',
		border: '1px solid var(--vscode-widget-border)',
		backgroundColor: 'transparent',
		color: 'var(--vscode-foreground)',
		cursor: 'pointer',
		fontSize: '13px',
		borderRadius: '2px',
	},
	saveButton: {
		padding: '6px 14px',
		border: 'none',
		backgroundColor: 'var(--vscode-button-background)',
		color: 'var(--vscode-button-foreground)',
		cursor: 'pointer',
		fontSize: '13px',
		borderRadius: '2px',
	},
};
