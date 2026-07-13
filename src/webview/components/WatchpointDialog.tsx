import { useState } from 'react';
import type { WatchpointAccessType, WatchpointBackend, WatchpointTarget } from '../../protocol/methods.js';
import { WriteDialogShell, writeDialogControlStyle } from './WriteDialogShell.js';

interface WatchpointDialogProps {
	target: WatchpointTarget;
	backend: WatchpointBackend;
	description: string;
	accessTypes: WatchpointAccessType[];
	error: string | null;
	isSubmitting: boolean;
	onCancel: () => void;
	onConfirm: (accessType: WatchpointAccessType) => void;
}

export function WatchpointDialog({ target, backend, description, accessTypes, error, isSubmitting, onCancel, onConfirm }: WatchpointDialogProps): JSX.Element {
	const [accessType, setAccessType] = useState<WatchpointAccessType>(accessTypes.includes('write') ? 'write' : accessTypes[0] ?? 'write');
	const targetLabel = target.kind === 'register' ? target.label : `${target.address} · ${target.bytes} byte${target.bytes === 1 ? '' : 's'}`;
	return <WriteDialogShell
		title="Set watchpoint"
		ariaLabel="Set watchpoint"
		meta={<><span>{target.kind === 'register' ? 'Register' : 'Memory range'}: {targetLabel}</span><span>{backend === 'gdb' ? 'GDB fallback' : 'DAP'}</span><span>{description}</span></>}
		preview={accessTypes.length ? `Stop on ${accessLabel(accessType).toLowerCase()} access.` : 'Debugger did not specify an access type.'}
		error={error}
		isSubmitting={isSubmitting}
		confirmDisabled={accessTypes.length === 0}
		confirmLabel="Set watchpoint"
		onCancel={onCancel}
		onConfirm={() => onConfirm(accessType)}
	>
		<select value={accessType} onChange={(event) => setAccessType(event.target.value as WatchpointAccessType)} disabled={isSubmitting || accessTypes.length === 0} style={{ ...writeDialogControlStyle, width: '100%' }} aria-label="Watchpoint access type">
			{accessTypes.map((type) => <option key={type} value={type}>{accessLabel(type)}</option>)}
		</select>
	</WriteDialogShell>;
}

function accessLabel(type: WatchpointAccessType): string {
	return type === 'readWrite' ? 'Read and write' : type === 'read' ? 'Read' : 'Write';
}
