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
 * Single stack frame returned from the debugger.
 */
export interface StackFrameResult {
	id: number;
	threadId: number;
	name: string;
	sourceName?: string;
	sourcePath?: string;
	line?: number;
	column?: number;
	instructionPointerReference?: string;
}

/**
 * Thread with its current stack frames.
 */
export interface StackThreadResult {
	id: number;
	name: string;
	frames: StackFrameResult[];
}

/**
 * Single disassembled instruction returned from the debugger.
 */
export interface DisassembledInstructionResult {
	address: string;
	instruction: string;
	instructionBytes?: string;
	symbol?: string;
	sourceName?: string;
	sourcePath?: string;
	line?: number;
	column?: number;
}

/**
 * Result of reading disassembly for the current instruction window.
 */
export interface DisassemblyResult {
	instructions: DisassembledInstructionResult[];
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
		expressions: string[],
		frameId?: number
	): Promise<RegisterEvalResult[]>;

	/**
	 * Lists debugger threads and their stack frames.
	 * @param sessionId - Debug session ID.
	 * @returns Current threads and frames for the session.
	 */
	listCallStack(sessionId: string): Promise<StackThreadResult[]>;

	/**
	 * Reads a disassembly window around the selected frame instruction pointer.
	 * @param sessionId - Debug session ID.
	 * @param instructionPointerReference - Memory reference for the current instruction pointer.
	 * @param before - Instructions requested before the current one.
	 * @param after - Instructions requested after the current one.
	 * @returns Disassembled instructions or an error description when unavailable.
	 */
	readDisassembly(
		sessionId: string,
		instructionPointerReference: string,
		before: number,
		after: number
	): Promise<DisassemblyResult>;
}
