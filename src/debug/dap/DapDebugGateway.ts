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

			if (!response) {
				// Complete failure - return array of nulls to indicate unreadable
				return this.createUnreadableResult(memoryReference, offset, count);
			}

			if (!response.data) {
				// No data returned - treat as unreadable
				return this.createUnreadableResult(memoryReference, offset, count);
			}

			// DAP returns data as base64 encoded string
			const base64Data: string = response.data;
			const bytes = this.decodeBase64(base64Data);

			// Check if we got fewer bytes than requested
			const hasUnreadable = bytes.length < count;
			
			// Pad with nulls if fewer bytes returned
			const paddedData: (number | null)[] = [...bytes];
			while (paddedData.length < count) {
				paddedData.push(null);
			}

			return {
				address: response.address ?? memoryReference,
				data: paddedData,
				bytesRead: bytes.length,
				hasUnreadable,
			};
		} catch (err) {
			console.error('[DapDebugGateway] readMemory failed:', err);
			// Return unreadable result instead of null to show the grid with ~~ markers
			return this.createUnreadableResult(memoryReference, offset, count);
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

	private createUnreadableResult(
		memoryReference: string,
		offset: number,
		count: number
	): ReadMemoryResult {
		// Calculate the address including offset
		let address = memoryReference;
		try {
			const baseAddr = BigInt(memoryReference);
			address = '0x' + (baseAddr + BigInt(offset)).toString(16);
		} catch {
			// Keep original reference if parsing fails
		}

		return {
			address,
			data: new Array(count).fill(null),
			bytesRead: 0,
			hasUnreadable: true,
		};
	}
}
