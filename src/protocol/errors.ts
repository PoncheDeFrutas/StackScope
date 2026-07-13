/**
 * Structured protocol error codes.
 */
export enum ProtocolErrorCode {
	NO_ACTIVE_SESSION = 'NO_ACTIVE_SESSION',
	SESSION_NOT_STOPPED = 'SESSION_NOT_STOPPED',
	READ_MEMORY_FAILED = 'READ_MEMORY_FAILED',
	REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
	WRITE_MEMORY_UNSUPPORTED = 'WRITE_MEMORY_UNSUPPORTED',
	WRITE_MEMORY_FAILED = 'WRITE_MEMORY_FAILED',
	WRITE_MEMORY_VERIFICATION_FAILED = 'WRITE_MEMORY_VERIFICATION_FAILED',
	WRITE_REGISTER_UNSUPPORTED = 'WRITE_REGISTER_UNSUPPORTED',
	WRITE_REGISTER_FAILED = 'WRITE_REGISTER_FAILED',
	WRITE_REGISTER_VERIFICATION_FAILED = 'WRITE_REGISTER_VERIFICATION_FAILED',
	INVALID_ADDRESS = 'INVALID_ADDRESS',
	DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
	SYMBOL_NOT_FOUND = 'SYMBOL_NOT_FOUND',
	REGISTER_NOT_AVAILABLE = 'REGISTER_NOT_AVAILABLE',
	WATCHPOINT_UNSUPPORTED = 'WATCHPOINT_UNSUPPORTED',
	WATCHPOINT_UNAVAILABLE = 'WATCHPOINT_UNAVAILABLE',
	WATCHPOINT_CONFLICT = 'WATCHPOINT_CONFLICT',
	WATCHPOINT_FAILED = 'WATCHPOINT_FAILED',
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
 * Error raised by protocol clients while preserving structured host error data.
 */
export class ProtocolRequestError extends Error {
	readonly code: ProtocolErrorCode;
	readonly details: unknown;

	constructor(error: ProtocolError) {
		super(error.message);
		this.name = 'ProtocolRequestError';
		this.code = error.code;
		this.details = error.details;
	}
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

export function normalizeProtocolError(error: unknown): ProtocolError {
	if (
		error &&
		typeof error === 'object' &&
		'code' in error &&
		'message' in error
	) {
		return error as ProtocolError;
	}

	return createProtocolError(
		ProtocolErrorCode.UNKNOWN_ERROR,
		error instanceof Error ? error.message : 'Unknown error'
	);
}
