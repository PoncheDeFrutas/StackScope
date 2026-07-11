import * as vscode from 'vscode';
import type {
	DisassemblyResult,
	DisassembledInstructionResult,
	DebugGateway,
	ReadMemoryResult,
	RegisterEvalResult,
	StackFrameResult,
	StackThreadResult,
} from '../contracts/DebugGateway.js';
import { DapAddressResolver } from './DapAddressResolver.js';
import {
	getDapErrorMessage,
	normalizeReadMemoryResponse,
} from './DapResponseNormalizer.js';
import { ConcurrencyLimiter, mapWithConcurrency } from '../../shared/mapWithConcurrency.js';
import { reportHostError } from '../../host/services/HostErrorReporter.js';

const DEFAULT_MAX_CONCURRENT_DAP_REQUESTS = 4;

export interface DapDebugGatewayOptions {
	maxConcurrentRegisterEvaluations?: number;
	maxConcurrentStackTraces?: number;
	maxConcurrentMemoryReads?: number;
	sessionResolver?: (sessionId: string) => vscode.DebugSession | undefined;
}

/**
 * DAP-based implementation of DebugGateway.
 * Handles readMemory and evaluate requests via VS Code debug API.
 */
export class DapDebugGateway implements DebugGateway {
	private readonly resolver = new DapAddressResolver();
	private readonly maxConcurrentRegisterEvaluations: number;
	private readonly maxConcurrentStackTraces: number;
	private readonly memoryReadLimiter: ConcurrencyLimiter;
	private readonly sessionResolver: (sessionId: string) => vscode.DebugSession | undefined;

	constructor(options: DapDebugGatewayOptions = {}) {
		this.maxConcurrentRegisterEvaluations = normalizeConcurrencyLimit(
			options.maxConcurrentRegisterEvaluations
		);
		this.maxConcurrentStackTraces = normalizeConcurrencyLimit(
			options.maxConcurrentStackTraces
		);
		this.memoryReadLimiter = new ConcurrencyLimiter(
			normalizeConcurrencyLimit(options.maxConcurrentMemoryReads)
		);
		this.sessionResolver = options.sessionResolver ?? findActiveSession;
	}

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

		return this.memoryReadLimiter.run(async () => {
			try {
				const response = await session.customRequest('readMemory', {
					memoryReference,
					offset,
					count,
				});

				return normalizeReadMemoryResponse(memoryReference, offset, count, response);
			} catch (err) {
				reportHostError('DapDebugGateway.readMemory', err);
				return normalizeReadMemoryResponse(memoryReference, offset, count, null);
			}
		});
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
		expressions: string[],
		frameId?: number
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
		const effectiveFrameId = frameId ?? (await this.getTopFrameId(session));

		return mapWithConcurrency(
			expressions,
			this.maxConcurrentRegisterEvaluations,
			async (expression): Promise<RegisterEvalResult> => {
				try {
					const value = await this.evaluateRegister(session, expression, effectiveFrameId);
					return { expression, value };
				} catch (err) {
					return { expression, value: null, error: getDapErrorMessage(err) };
				}
			}
		);
	}

	async listCallStack(sessionId: string): Promise<StackThreadResult[]> {
		const session = this.findSession(sessionId);
		if (!session) {
			return [];
		}

		try {
			const threadsResponse = await session.customRequest('threads');
			if (!threadsResponse?.threads?.length) {
				return [];
			}

			const threads = threadsResponse.threads as Array<{ id: number; name?: string }>;

			const stackResults = await mapWithConcurrency(
				threads,
				this.maxConcurrentStackTraces,
				async (thread): Promise<StackThreadResult> => {
					try {
						const stackResponse = await session.customRequest('stackTrace', {
							threadId: thread.id,
							startFrame: 0,
							levels: 100,
						});

						const frames = Array.isArray(stackResponse?.stackFrames)
							? stackResponse.stackFrames.map((frame: {
								id: number;
								name?: string;
								line?: number;
								column?: number;
								instructionPointerReference?: string;
								source?: { name?: string; path?: string };
							}): StackFrameResult => ({
								id: frame.id,
								threadId: thread.id,
								name: frame.name ?? `Frame ${frame.id}`,
								sourceName: frame.source?.name,
								sourcePath: frame.source?.path,
								line: frame.line,
								column: frame.column,
								instructionPointerReference: frame.instructionPointerReference,
							}))
							: [];

						return {
							id: thread.id,
							name: thread.name ?? `Thread ${thread.id}`,
							frames,
						};
					} catch {
						return {
							id: thread.id,
							name: thread.name ?? `Thread ${thread.id}`,
							frames: [],
						};
					}
				}
			);

			return stackResults;
		} catch (err) {
			reportHostError('DapDebugGateway.listCallStack', err);
			return [];
		}
	}

	async readDisassembly(
		sessionId: string,
		instructionPointerReference: string,
		before: number,
		after: number
	): Promise<DisassemblyResult> {
		const session = this.findSession(sessionId);
		if (!session) {
			return {
				instructions: [],
				error: 'No active session',
			};
		}

		try {
			const response = await session.customRequest('disassemble', {
				memoryReference: instructionPointerReference,
				instructionOffset: -Math.max(0, before),
				instructionCount: Math.max(1, before + after + 1),
				resolveSymbols: true,
			});

			const instructions = Array.isArray(response?.instructions)
				? response.instructions.map((instruction: {
					address: string;
					instruction?: string;
					instructionBytes?: string;
					symbol?: string;
					location?: { name?: string; path?: string };
					line?: number;
					column?: number;
				}): DisassembledInstructionResult => ({
					address: instruction.address,
					instruction: instruction.instruction ?? '',
					instructionBytes: instruction.instructionBytes,
					symbol: instruction.symbol,
					sourceName: instruction.location?.name,
					sourcePath: instruction.location?.path,
					line: instruction.line,
					column: instruction.column,
				}))
				: [];

			return { instructions };
		} catch (err) {
			const message = getDapErrorMessage(err);
			reportHostError('DapDebugGateway.readDisassembly', err);
			return {
				instructions: [],
				error: message,
			};
		}
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
		return this.sessionResolver(sessionId);
	}

}

function normalizeConcurrencyLimit(value: number | undefined): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return DEFAULT_MAX_CONCURRENT_DAP_REQUESTS;
	}
	return Math.max(1, Math.floor(value));
}

function findActiveSession(sessionId: string): vscode.DebugSession | undefined {
	return vscode.debug.activeDebugSession?.id === sessionId
		? vscode.debug.activeDebugSession
		: undefined;
}
