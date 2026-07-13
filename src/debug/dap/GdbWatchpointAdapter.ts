import type * as vscode from 'vscode';
import type { DataBreakpointAccessType, GdbWatchpointResult } from '../contracts/DebugGateway.js';
import { getDapErrorMessage } from './DapResponseNormalizer.js';

/** Executes the narrow, validated subset of GDB commands used for register watchpoints. */
export async function createGdbWatchpoint(
	session: vscode.DebugSession,
	expression: string,
	accessType: DataBreakpointAccessType
): Promise<GdbWatchpointResult> {
	const register = normalizeGdbWatchpointRegister(expression);
	if (!register) {
		return { breakpointId: null, verified: false, message: 'GDB fallback only accepts a single register expression.' };
	}
	const command = accessType === 'read' ? 'rwatch' : accessType === 'readWrite' ? 'awatch' : 'watch';
	try {
		const response = await session.customRequest('evaluate', { expression: `-exec ${command} ${register}`, context: 'repl' }) as { result?: unknown };
		const message = typeof response?.result === 'string' ? response.result : '';
		const breakpointId = parseGdbWatchpointId(message);
		return breakpointId === null
			? { breakpointId: null, verified: false, message: message || 'GDB did not create a watchpoint.' }
			: { breakpointId, verified: true, message: message || undefined };
	} catch (error) {
		return { breakpointId: null, verified: false, message: getDapErrorMessage(error) };
	}
}

export async function removeGdbWatchpoint(session: vscode.DebugSession, breakpointId: number): Promise<GdbWatchpointResult> {
	try {
		await session.customRequest('evaluate', { expression: `-exec delete ${breakpointId}`, context: 'repl' });
		return { breakpointId, verified: true };
	} catch (error) {
		return { breakpointId, verified: false, message: getDapErrorMessage(error) };
	}
}

export function parseGdbWatchpointId(message: string): number | null {
	const match = message.match(/(?:hardware |software )?(?:access |read |watch)?watchpoint\s+(\d+)/i);
	return match ? Number(match[1]) : null;
}

function normalizeGdbWatchpointRegister(expression: string): string | null {
	const trimmed = expression.trim();
	const register = trimmed.startsWith('$') ? trimmed : `$${trimmed}`;
	return /^\$[A-Za-z_][A-Za-z0-9_.$]*$/.test(register) ? register : null;
}
