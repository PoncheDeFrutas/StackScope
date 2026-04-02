import type { MemoryDocument } from './MemoryDocument.js';

/**
 * Registry for active memory documents.
 * Pure domain model — no VS Code imports.
 */
export class DocumentRegistry {
	private readonly documents = new Map<string, MemoryDocument>();
	private activeDocumentId: string | null = null;

	/**
	 * Adds a document to the registry.
	 */
	add(doc: MemoryDocument): void {
		this.documents.set(doc.id, doc);
	}

	/**
	 * Removes a document from the registry.
	 */
	remove(id: string): boolean {
		if (this.activeDocumentId === id) {
			this.activeDocumentId = null;
		}
		return this.documents.delete(id);
	}

	/**
	 * Gets a document by ID.
	 */
	get(id: string): MemoryDocument | undefined {
		return this.documents.get(id);
	}

	/**
	 * Sets the active document.
	 */
	setActive(id: string | null): void {
		if (id !== null && !this.documents.has(id)) {
			throw new Error(`Document ${id} not found in registry`);
		}
		this.activeDocumentId = id;
	}

	/**
	 * Gets the active document.
	 */
	getActive(): MemoryDocument | null {
		if (this.activeDocumentId === null) {
			return null;
		}
		return this.documents.get(this.activeDocumentId) ?? null;
	}

	/**
	 * Gets all documents.
	 */
	getAll(): MemoryDocument[] {
		return Array.from(this.documents.values());
	}

	/**
	 * Clears all documents for a given session.
	 */
	clearSession(sessionId: string): void {
		for (const [id, doc] of this.documents) {
			if (doc.sessionId === sessionId) {
				this.remove(id);
			}
		}
	}

	/**
	 * Clears all documents.
	 */
	clear(): void {
		this.documents.clear();
		this.activeDocumentId = null;
	}
}
