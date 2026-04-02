import * as vscode from 'vscode';

/**
 * Resolves an address expression to a memory reference.
 * Handles:
 * - Literal hex addresses (0x...) — used directly
 * - Decimal addresses — converted to hex
 * - Expressions (variables, &var, etc.) — evaluated via DAP
 */
export class DapAddressResolver {
	/**
	 * Resolves an address expression to a memory reference string.
	 * @param session - The debug session.
	 * @param expression - Address expression (literal or expression).
	 * @param frameId - Optional frame ID for expression evaluation.
	 * @returns The memory reference string.
	 */
	async resolve(
		session: vscode.DebugSession,
		expression: string,
		frameId?: number
	): Promise<string | null> {
		const trimmed = expression.trim();

		// If it looks like a literal hex address, use it directly
		if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) {
			return trimmed;
		}

		// If it's a plain decimal number, convert to hex
		if (/^\d+$/.test(trimmed)) {
			const num = BigInt(trimmed);
			return '0x' + num.toString(16);
		}

		// Get frame ID if not provided - needed for variable evaluation
		const effectiveFrameId = frameId ?? (await this.getTopFrameId(session));

		// Try different evaluation strategies
		return (
			(await this.tryEvaluate(session, trimmed, effectiveFrameId)) ??
			(await this.tryEvaluate(session, `&(${trimmed})`, effectiveFrameId)) ??
			(await this.tryEvaluate(session, `(void*)&(${trimmed})`, effectiveFrameId)) ??
			null
		);
	}

	private async tryEvaluate(
		session: vscode.DebugSession,
		expression: string,
		frameId?: number
	): Promise<string | null> {
		try {
			const response = await session.customRequest('evaluate', {
				expression,
				context: 'watch',
				frameId,
			});

			// Some adapters return memoryReference directly
			if (response.memoryReference) {
				return response.memoryReference;
			}

			// Try to extract address from result (e.g., "0x20000000", "(void *) 0x7fff5c2a")
			const match = response.result?.match(/0x[0-9a-fA-F]+/i);
			if (match) {
				return match[0];
			}

			return null;
		} catch {
			return null;
		}
	}

	private async getTopFrameId(session: vscode.DebugSession): Promise<number | undefined> {
		try {
			// Get threads
			const threadsResponse = await session.customRequest('threads');
			if (!threadsResponse?.threads?.length) {
				return undefined;
			}

			// Get stack trace for first thread
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
}
