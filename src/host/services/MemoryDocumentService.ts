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
import { DebugMutationService } from './DebugMutationService.js';

type DocumentSnapshot = MethodMap['listDocuments']['result']['documents'][number];
export const MAX_MEMORY_WRITE_BYTES = 16;

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
		private readonly onDocumentsChanged: (payload: DocumentChangedPayload) => void,
		private readonly debugMutations = new DebugMutationService()
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
		const resolved = await this.resolveMemoryReference(doc, state.sessionId);
		doc = resolved.document;
		if (!resolved.hasResolvedReference) {
			return this.createUnreadableResult(count);
		}

		const result = await this.debugGateway.readMemory(
			state.sessionId,
			resolved.reference,
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

	async writeMemory(params: MethodMap['writeMemory']['params']): Promise<MethodMap['writeMemory']['result']> {
		if (!Number.isInteger(params.offset) || params.offset < 0) {
			throw createProtocolError(ProtocolErrorCode.WRITE_MEMORY_FAILED, 'Write offset must be a non-negative integer');
		}
		if (!params.data.length || params.data.length > MAX_MEMORY_WRITE_BYTES || params.data.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
			throw createProtocolError(ProtocolErrorCode.WRITE_MEMORY_FAILED, 'Write data must contain bytes');
		}
		const doc = this.documentRegistry.get(params.documentId);
		if (!doc) {
			throw createProtocolError(ProtocolErrorCode.DOCUMENT_NOT_FOUND, `Document ${params.documentId} not found`);
		}
		if (params.offset + params.data.length > doc.config.totalSize) {
			throw createProtocolError(ProtocolErrorCode.WRITE_MEMORY_FAILED, 'Write range exceeds the active memory document');
		}
		const state = await this.requireStoppedSession('Pause execution before writing memory.');
		return this.debugMutations.run(state.sessionId, async () => {
			const current = await this.requireStoppedSession('Pause execution before writing memory.');
			const currentDocument = this.documentRegistry.get(params.documentId);
			if (!currentDocument || currentDocument.sessionId !== current.sessionId) {
				throw createProtocolError(ProtocolErrorCode.NO_ACTIVE_SESSION, 'Document belongs to another debug session');
			}
			if (params.offset + params.data.length > currentDocument.config.totalSize) {
				throw createProtocolError(ProtocolErrorCode.WRITE_MEMORY_FAILED, 'Write range exceeds the active memory document');
			}
			const resolved = await this.resolveMemoryReference(currentDocument, current.sessionId);
			if (!resolved.hasResolvedReference) {
				throw createProtocolError(ProtocolErrorCode.WRITE_MEMORY_FAILED, 'Could not resolve the memory reference for this document');
			}
			const write = await this.debugGateway.writeMemory(current.sessionId, resolved.reference, params.offset, params.data, true);
			if (!write) {
				throw createProtocolError(ProtocolErrorCode.WRITE_MEMORY_UNSUPPORTED, 'Debugger does not support verified memory writes');
			}
			if (write.error && write.bytesWritten === 0) {
				throw createProtocolError(ProtocolErrorCode.WRITE_MEMORY_FAILED, write.error);
			}
			const verification = await this.debugGateway.readMemory(current.sessionId, resolved.reference, write.offset, write.bytesWritten);
			if (!verification) {
				throw createProtocolError(ProtocolErrorCode.WRITE_MEMORY_VERIFICATION_FAILED, 'Could not verify memory write');
			}
			const expected = params.data.slice(0, write.bytesWritten);
			const verified = verification.data.length >= expected.length && expected.every((byte, index) => verification.data[index] === byte);
			return { offset: write.offset, bytesWritten: write.bytesWritten, partial: write.bytesWritten !== params.data.length, verification, verified };
		});
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
			`doc_${crypto.randomUUID()}`,
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

	private async resolveMemoryReference(
		document: MemoryDocument,
		sessionId: string
	): Promise<{ document: MemoryDocument; reference: string; hasResolvedReference: boolean }> {
		if (!document.isDynamic) {
			return {
				document,
				reference: document.memoryReference,
				hasResolvedReference: document.hasResolvedReference,
			};
		}
		const reference = await this.debugGateway.evaluateForMemoryReference(
			sessionId,
			document.address,
			this.getSelectedFrameId(sessionId)
		);
		if (!reference) {
			return {
				document,
				reference: document.memoryReference,
				hasResolvedReference: document.hasResolvedReference,
			};
		}
		const updated = reference === document.memoryReference
			? document
			: this.documentRegistry.updateMemoryReference(document.id, reference) ?? document;
		return { document: updated, reference, hasResolvedReference: true };
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
