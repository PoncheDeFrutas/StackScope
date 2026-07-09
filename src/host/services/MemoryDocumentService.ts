import type { DebugGateway } from '../../debug/contracts/DebugGateway.js';
import type { SessionTracker } from '../../debug/contracts/SessionTracker.js';
import { DEFAULT_CONFIG } from '../../domain/config/MemoryViewConfig.js';
import type { DocumentRegistry } from '../../domain/documents/DocumentRegistry.js';
import {
	createMemoryDocument,
	isLiteralAddress,
	type MemoryDocument,
} from '../../domain/documents/MemoryDocument.js';
import { ProtocolErrorCode, createProtocolError } from '../../protocol/errors.js';
import type { DocumentChangedPayload } from '../../protocol/events.js';
import type { MethodMap } from '../../protocol/methods.js';
import { generateDocumentId } from '../../shared/ids.js';

type DocumentSnapshot = MethodMap['listDocuments']['result']['documents'][number];

/**
 * Owns document lifecycle and debugger-backed memory reads for the host.
 * Protocol transport remains the responsibility of HostMessageRouter.
 */
export class MemoryDocumentService {
	constructor(
		private readonly sessionTracker: SessionTracker,
		private readonly debugGateway: DebugGateway,
		private readonly documentRegistry: DocumentRegistry,
		private readonly getSelectedFrameId: (sessionId: string) => number | undefined,
		private readonly onDocumentsChanged: (payload: DocumentChangedPayload) => void
	) {}

	async readMemory(
		params: MethodMap['readMemory']['params']
	): Promise<MethodMap['readMemory']['result']> {
		const { documentId, offset, count } = params;
		let doc = this.documentRegistry.get(documentId);
		if (!doc) {
			throw createProtocolError(
				ProtocolErrorCode.DOCUMENT_NOT_FOUND,
				`Document ${documentId} not found`
			);
		}

		const state = await this.requireStoppedSession(
			'Debug session is not stopped. Pause execution to read memory.'
		);
		let memoryReference = doc.memoryReference;
		if (doc.isDynamic) {
			const newReference = await this.debugGateway.evaluateForMemoryReference(
				state.sessionId,
				doc.address,
				this.getSelectedFrameId(state.sessionId)
			);
			if (newReference) {
				memoryReference = newReference;
				if (newReference !== doc.memoryReference) {
					const updated = this.documentRegistry.updateMemoryReference(documentId, newReference);
					if (updated) {
						doc = updated;
					}
				}
			} else if (!doc.hasResolvedReference) {
				return this.createUnreadableResult(count);
			}
		}

		const result = await this.debugGateway.readMemory(
			state.sessionId,
			memoryReference,
			offset,
			count
		);
		if (!result) {
			throw createProtocolError(
				ProtocolErrorCode.READ_MEMORY_FAILED,
				'Failed to read memory from debugger'
			);
		}

		return result;
	}

	async openDocument(
		params: MethodMap['openDocument']['params']
	): Promise<MethodMap['openDocument']['result']> {
		const { target, displayName, config } = params;
		const state = await this.requireStoppedSession(
			'Debug session is not stopped. Pause execution first.'
		);
		const existingDoc = this.documentRegistry.findBySessionTarget(state.sessionId, target);
		if (existingDoc) {
			this.documentRegistry.setActive(existingDoc.id);
			const document = this.toSnapshot(existingDoc);
			const documents = this.getSnapshots();
			this.notify(document, documents);
			return { document, documents };
		}

		const memoryReference = await this.debugGateway.evaluateForMemoryReference(
			state.sessionId,
			target,
			this.getSelectedFrameId(state.sessionId)
		);
		const literal = isLiteralAddress(target);
		const resolvedReference = memoryReference ?? (literal ? target.trim() : '0x0');
		const hasResolvedReference = memoryReference !== null;
		if (!hasResolvedReference && literal) {
			throw createProtocolError(
				ProtocolErrorCode.INVALID_ADDRESS,
				`Could not parse literal address "${target}".`
			);
		}

		const doc = createMemoryDocument(
			generateDocumentId(),
			target,
			state.sessionId,
			resolvedReference,
			hasResolvedReference,
			config ?? DEFAULT_CONFIG,
			displayName?.trim() || target
		);
		this.documentRegistry.add(doc);
		this.documentRegistry.setActive(doc.id);

		const document = this.toSnapshot(doc);
		const documents = this.getSnapshots();
		this.notify(document, documents);
		return { document, documents };
	}

	listDocuments(): MethodMap['listDocuments']['result'] {
		return {
			documents: this.getSnapshots(),
			activeDocument: this.getActiveSnapshot(),
		};
	}

	selectDocument(
		params: MethodMap['selectDocument']['params']
	): MethodMap['selectDocument']['result'] {
		const doc = this.documentRegistry.get(params.id);
		if (!doc) {
			throw createProtocolError(
				ProtocolErrorCode.DOCUMENT_NOT_FOUND,
				`Document ${params.id} not found`
			);
		}
		this.documentRegistry.setActive(doc.id);

		const document = this.toSnapshot(doc);
		const documents = this.getSnapshots();
		this.notify(document, documents);
		return { document, documents };
	}

	closeDocument(
		params: MethodMap['closeDocument']['params']
	): MethodMap['closeDocument']['result'] {
		const wasActive = this.documentRegistry.getActive()?.id === params.id;
		this.documentRegistry.remove(params.id);
		if (wasActive) {
			this.documentRegistry.setActive(this.documentRegistry.getAll()[0]?.id ?? null);
		}

		const activeDocument = this.getActiveSnapshot();
		const documents = this.getSnapshots();
		this.notify(activeDocument, documents);
		return { activeDocument, documents };
	}

	updateDocument(
		params: MethodMap['updateDocument']['params']
	): MethodMap['updateDocument']['result'] {
		const doc = this.documentRegistry.updateMetadata(params.id, {
			displayName: params.displayName?.trim() || undefined,
			config: params.config,
		});
		if (!doc) {
			throw createProtocolError(
				ProtocolErrorCode.DOCUMENT_NOT_FOUND,
				`Document ${params.id} not found`
			);
		}

		const document = this.toSnapshot(doc);
		const documents = this.getSnapshots();
		this.notify(document, documents);
		return { document, documents };
	}

	getSnapshots(): MethodMap['listDocuments']['result']['documents'] {
		return this.documentRegistry.getAll().map((doc) => this.toSnapshot(doc));
	}

	getActiveSnapshot(): MethodMap['listDocuments']['result']['activeDocument'] {
		const doc = this.documentRegistry.getActive();
		return doc ? this.toSnapshot(doc) : null;
	}

	private async requireStoppedSession(
		notStoppedMessage: string
	): Promise<{ sessionId: string }> {
		const state = await this.sessionTracker.refresh();
		if (!state.sessionId) {
			throw createProtocolError(ProtocolErrorCode.NO_ACTIVE_SESSION, 'No active debug session');
		}
		if (state.status !== 'stopped') {
			throw createProtocolError(
				ProtocolErrorCode.SESSION_NOT_STOPPED,
				notStoppedMessage
			);
		}
		return { sessionId: state.sessionId };
	}

	private notify(
		document: DocumentChangedPayload['document'],
		documents: DocumentChangedPayload['documents']
	): void {
		this.onDocumentsChanged({ document, documents });
	}

	private toSnapshot(doc: MemoryDocument): DocumentSnapshot {
		return {
			id: doc.id,
			address: doc.address,
			displayName: doc.displayName,
			sessionId: doc.sessionId,
			config: doc.config,
		};
	}

	private createUnreadableResult(count: number): MethodMap['readMemory']['result'] {
		return {
			address: '0x0',
			data: new Array(count).fill(null),
			bytesRead: 0,
			hasUnreadable: true,
		};
	}
}
