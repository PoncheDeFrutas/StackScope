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
	/** True when memoryReference was successfully resolved at least once. */
	readonly hasResolvedReference: boolean;
	/** 
	 * Whether the address is dynamic (register/expression) and needs re-resolution on each read.
	 * Literal hex addresses (0x...) are static, everything else is dynamic.
	 */
	readonly isDynamic: boolean;
}

/**
 * Checks if an address expression is a literal hex address.
 */
export function isLiteralAddress(address: string): boolean {
	const trimmed = address.trim();
	// Literal hex address: 0x followed by hex digits
	if (/^0x[0-9a-fA-F]+$/i.test(trimmed)) {
		return true;
	}
	// Plain decimal number
	if (/^\d+$/.test(trimmed)) {
		return true;
	}
	return false;
}

/**
 * Creates a new MemoryDocument.
 */
export function createMemoryDocument(
	id: string,
	address: string,
	sessionId: string,
	memoryReference: string,
	hasResolvedReference = true
): MemoryDocument {
	const isDynamic = !isLiteralAddress(address);
	return Object.freeze({
		id,
		address,
		sessionId,
		memoryReference,
		hasResolvedReference,
		isDynamic,
	});
}
