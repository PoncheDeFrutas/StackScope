/**
 * Structured protocol error codes.
 */
export enum ProtocolErrorCode {
	NO_ACTIVE_SESSION = 'NO_ACTIVE_SESSION',
	SESSION_NOT_STOPPED = 'SESSION_NOT_STOPPED',
	READ_MEMORY_FAILED = 'READ_MEMORY_FAILED',
	INVALID_ADDRESS = 'INVALID_ADDRESS',
	DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
	SYMBOL_NOT_FOUND = 'SYMBOL_NOT_FOUND',
	REGISTER_NOT_AVAILABLE = 'REGISTER_NOT_AVAILABLE',
	UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured protocol error payload.
 */
export interface ProtocolError {
	code: ProtocolErrorCode;
	message: string;
	details?: unknown;
}

/**
 * Creates a typed protocol error.
 */
export function createProtocolError(
	code: ProtocolErrorCode,
	message: string,
	details?: unknown
): ProtocolError {
	return { code, message, details };
}
