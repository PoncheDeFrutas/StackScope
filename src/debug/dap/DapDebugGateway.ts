import * as vscode from 'vscode';
import type { DebugGateway, ReadMemoryResult } from '../contracts/DebugGateway.js';
import { DapAddressResolver } from './DapAddressResolver.js';

/**
 * DAP-based implementation of DebugGateway.
 * Handles readMemory and evaluate requests via VS Code debug API.
 */
export class DapDebugGateway implements DebugGateway {
	private readonly resolver = new DapAddressResolver();

	async readMemory(
		sessionId: string,
		memoryReference: string,
		offset: number,
		count: number
	): Promise<ReadMemoryResult | null> {
		const session = this.findSession(sessionId);
		if (!session) {
			return null;
		}

		try {
			const response = await session.customRequest('readMemory', {
				memoryReference,
				offset,
				count,
			});

			if (!response || !response.data) {
				return null;
			}

			// DAP returns data as base64 encoded string
			const base64Data: string = response.data;
			const bytes = this.decodeBase64(base64Data);

			return {
				address: response.address ?? memoryReference,
				data: bytes,
				bytesRead: bytes.length,
			};
		} catch (err) {
			console.error('[DapDebugGateway] readMemory failed:', err);
			return null;
		}
	}

	async evaluateForMemoryReference(
		sessionId: string,
		expression: string,
		frameId?: number
	): Promise<string | null> {
		const session = this.findSession(sessionId);
		if (!session) {
			return null;
		}

		return this.resolver.resolve(session, expression, frameId);
	}

	private findSession(sessionId: string): vscode.DebugSession | undefined {
		// First check active session
		if (vscode.debug.activeDebugSession?.id === sessionId) {
			return vscode.debug.activeDebugSession;
		}
		// Fallback: could iterate all sessions if needed in future
		return undefined;
	}

	private decodeBase64(base64: string): number[] {
		// Node.js Buffer is available in VS Code extension host
		const buffer = Buffer.from(base64, 'base64');
		return Array.from(buffer);
	}
}
