/**
 * Immutable representation of a memory view document.
 * Pure domain model — no VS Code imports.
 */
export interface MemoryDocument {
	/** Unique document identifier. */
	readonly id: string;
	/** The address expression or literal (e.g., "0x20000000" or "&myVar"). */
	readonly address: string;
	/** Debug session ID this document is bound to. */
	readonly sessionId: string;
	/** Resolved memory reference for DAP readMemory (may differ from address). */
	readonly memoryReference: string;
}

/**
 * Creates a new MemoryDocument.
 */
export function createMemoryDocument(
	id: string,
	address: string,
	sessionId: string,
	memoryReference: string
): MemoryDocument {
	return Object.freeze({ id, address, sessionId, memoryReference });
}
