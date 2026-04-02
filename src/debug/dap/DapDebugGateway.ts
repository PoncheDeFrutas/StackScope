import * as vscode from 'vscode';
import type { DebugGateway, ReadMemoryResult, RegisterEvalResult } from '../contracts/DebugGateway.js';
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

	async readRegisters(
		sessionId: string,
		expressions: string[]
	): Promise<RegisterEvalResult[]> {
		const session = this.findSession(sessionId);
		if (!session) {
			return expressions.map((expression) => ({
				expression,
				value: null,
				error: 'No active session',
			}));
		}

		// Get frame ID for evaluation context
		const frameId = await this.getTopFrameId(session);

		// Evaluate all expressions in parallel
		const results = await Promise.all(
			expressions.map(async (expression): Promise<RegisterEvalResult> => {
				try {
					const value = await this.evaluateRegister(session, expression, frameId);
					return { expression, value };
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					return { expression, value: null, error: message };
				}
			})
		);

		return results;
	}

	private async evaluateRegister(
		session: vscode.DebugSession,
		expression: string,
		frameId?: number
	): Promise<string | null> {
		const trimmed = expression.trim();
		const expressionsToTry = this.buildRegisterExpressions(trimmed);

		const contexts = ['watch', 'hover'] as const;
		for (const expr of expressionsToTry) {
			for (const context of contexts) {
				try {
					const response = await session.customRequest('evaluate', {
						expression: expr,
						context,
						frameId,
					});

					if (!response?.result) {
						continue;
					}

					// Try to extract hex value if present
					const hexMatch = response.result.match(/0x[0-9a-fA-F]+/i);
					if (hexMatch) {
						return hexMatch[0];
					}

					return String(response.result);
				} catch {
					// Try next context or expression
				}
			}
		}

		return null;
	}

	private buildRegisterExpressions(expression: string): string[] {
		if (this.isRegisterExpression(expression)) {
			return [expression];
		}

		if (this.isBareRegisterExpression(expression)) {
			return [`$${expression}`, expression];
		}

		return [expression];
	}

	private isRegisterExpression(expression: string): boolean {
		return /^\$[a-zA-Z][a-zA-Z0-9]*$/.test(expression);
	}

	private isBareRegisterExpression(expression: string): boolean {
		return /^(x\d+|r\d+|pc|sp|lr|fp|ip|ra)$/i.test(expression);
	}

	private async getTopFrameId(session: vscode.DebugSession): Promise<number | undefined> {
		const activeFrame = vscode.debug.activeStackItem;
		if (
			activeFrame &&
			typeof activeFrame === 'object' &&
			'frameId' in activeFrame &&
			typeof (activeFrame as { frameId?: unknown }).frameId === 'number'
		) {
			return (activeFrame as { frameId: number }).frameId;
		}

		try {
			const threadsResponse = await session.customRequest('threads');
			if (!threadsResponse?.threads?.length) {
				return undefined;
			}

			const threadId = threadsResponse.threads[0].id;
			const stackResponse = await session.customRequest('stackTrace', {
				threadId,
				startFrame: 0,
				levels: 1,
			});

			if (stackResponse?.stackFrames?.length) {
				return stackResponse.stackFrames[0].id;
			}

			return undefined;
		} catch {
			return undefined;
		}
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
