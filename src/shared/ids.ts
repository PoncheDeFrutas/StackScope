/**
 * Generates a unique document ID.
 */
export function generateDocumentId(): string {
	return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generates a unique request ID for protocol messages.
 */
export function generateRequestId(): string {
	return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
