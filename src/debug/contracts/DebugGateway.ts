/**
 * Result of reading memory from the debugger.
 */
export interface ReadMemoryResult {
	/** Base address that was read (hex string). */
	address: string;
	/** 
	 * Memory bytes as array.
	 * - Numbers (0-255) for readable bytes
	 * - null for unreadable bytes  
	 */
	data: (number | null)[];
	/** Actual number of bytes returned. */
	bytesRead: number;
	/** True if some bytes could not be read. */
	hasUnreadable: boolean;
}

/**
 * Result of evaluating a single register.
 */
export interface RegisterEvalResult {
	/** Register expression that was evaluated */
	expression: string;
	/** Resolved value as hex string, or null if unavailable */
	value: string | null;
	/** Error message if evaluation failed */
	error?: string;
}

/**
 * Abstract contract for debugger memory operations.
 * All debugger access must go through this interface.
 */
export interface DebugGateway {
	/**
	 * Reads memory from the debugger.
	 * @param sessionId - Debug session ID.
	 * @param memoryReference - Memory reference string (address or DAP reference).
	 * @param offset - Byte offset from the reference.
	 * @param count - Number of bytes to read.
	 * @returns The read memory data or null if the read failed.
	 */
	readMemory(
		sessionId: string,
		memoryReference: string,
		offset: number,
		count: number
	): Promise<ReadMemoryResult | null>;

	/**
	 * Evaluates an expression and returns a memory reference if available.
	 * @param sessionId - Debug session ID.
	 * @param expression - Expression to evaluate.
	 * @param frameId - Optional frame ID for context.
	 * @returns Memory reference string or null if not available.
	 */
	evaluateForMemoryReference(
		sessionId: string,
		expression: string,
		frameId?: number
	): Promise<string | null>;

	/**
	 * Reads multiple register values.
	 * @param sessionId - Debug session ID.
	 * @param expressions - Array of register expressions to evaluate.
	 * @returns Array of evaluation results, one per input expression.
	 */
	readRegisters(
		sessionId: string,
		expressions: string[]
	): Promise<RegisterEvalResult[]>;
}
