import * as assert from 'assert';
import type { DebugGateway, ReadMemoryResult } from '../debug/contracts/DebugGateway.js';
import type { SessionState, SessionTracker } from '../debug/contracts/SessionTracker.js';
import { DocumentRegistry } from '../domain/documents/DocumentRegistry.js';
import { createMemoryDocument } from '../domain/documents/MemoryDocument.js';
import type { DocumentChangedPayload } from '../protocol/events.js';
import { ProtocolErrorCode } from '../protocol/errors.js';
import { MemoryDocumentService } from '../host/services/MemoryDocumentService.js';
import { MAX_MEMORY_WRITE_BYTES } from '../host/services/MemoryDocumentService.js';

function createSessionTracker(state: SessionState): SessionTracker {
	return {
		getState: () => state,
		refresh: async () => state,
		onStateChanged: () => () => undefined,
		dispose: () => undefined,
	};
}

function createDebugGateway(
	overrides: Partial<DebugGateway> = {}
): DebugGateway {
	const emptyRead: ReadMemoryResult = {
		address: '0x0',
		data: [],
		bytesRead: 0,
		hasUnreadable: false,
	};

	return {
		readMemory: async () => emptyRead,
		writeMemory: async () => ({ offset: 0, bytesWritten: 0 }),
		setExpression: async () => null,
		evaluateForMemoryReference: async () => null,
		readRegisters: async () => [],
		listCallStack: async () => [],
		readDisassembly: async () => ({ instructions: [] }),
		...overrides,
	};
}

suite('MemoryDocumentService', () => {
	test('opens a document, selects it, and emits its snapshot', async () => {
		const events: DocumentChangedPayload[] = [];
		const service = new MemoryDocumentService(
			createSessionTracker({ sessionId: 'session-1', status: 'stopped' }),
			createDebugGateway({
				evaluateForMemoryReference: async () => '0x2000',
			}),
			new DocumentRegistry(),
			() => 42,
			(payload) => events.push(payload)
		);

		const result = await service.openDocument({ target: '$sp', displayName: 'Stack pointer' });

		assert.strictEqual(result.document.address, '$sp');
		assert.strictEqual(result.document.displayName, 'Stack pointer');
		assert.strictEqual(result.documents.length, 1);
		assert.deepStrictEqual(events, [{ document: result.document, documents: result.documents }]);
	});

	test('reuses matching document and selects first remaining document after close', async () => {
		const registry = new DocumentRegistry();
		const service = new MemoryDocumentService(
			createSessionTracker({ sessionId: 'session-1', status: 'stopped' }),
			createDebugGateway({ evaluateForMemoryReference: async () => '0x2000' }),
			registry,
			() => undefined,
			() => undefined
		);

		const first = await service.openDocument({ target: '$sp' });
		const repeated = await service.openDocument({ target: '  $sp  ' });
		const second = await service.openDocument({ target: '$pc' });
		const closed = service.closeDocument({ id: second.document.id });

		assert.strictEqual(repeated.document.id, first.document.id);
		assert.strictEqual(registry.getAll().length, 1);
		assert.strictEqual(closed.activeDocument?.id, first.document.id);
	});

	test('re-resolves dynamic document before reading memory', async () => {
		const registry = new DocumentRegistry();
		registry.add(createMemoryDocument('doc-1', '$sp', 'session-1', '0x0', false));
		const reads: Array<{ reference: string; frameId: number | undefined }> = [];
		const service = new MemoryDocumentService(
			createSessionTracker({ sessionId: 'session-1', status: 'stopped' }),
			createDebugGateway({
				evaluateForMemoryReference: async (_sessionId, _expression, frameId) => {
					reads.push({ reference: 'evaluate', frameId });
					return '0x2000';
				},
				readMemory: async (_sessionId, reference) => {
					reads.push({ reference, frameId: undefined });
					return {
						address: reference,
						data: [1, 2],
						bytesRead: 2,
						hasUnreadable: false,
					};
				},
			}),
			registry,
			() => 42,
			() => undefined
		);

		const result = await service.readMemory({ documentId: 'doc-1', offset: 0, count: 2 });

		assert.strictEqual(result.address, '0x2000');
		assert.deepStrictEqual(reads, [
			{ reference: 'evaluate', frameId: 42 },
			{ reference: '0x2000', frameId: undefined },
		]);
		assert.strictEqual(registry.get('doc-1')?.memoryReference, '0x2000');
	});

	test('rejects a missing document before querying the debugger', async () => {
		let reads = 0;
		const service = new MemoryDocumentService(
			createSessionTracker({ sessionId: 'session-1', status: 'stopped' }),
			createDebugGateway({
				readMemory: async () => {
					reads += 1;
					return null;
				},
			}),
			new DocumentRegistry(),
			() => undefined,
			() => undefined
		);

		await assert.rejects(
			() => service.readMemory({ documentId: 'missing', offset: 0, count: 16 }),
			(error: unknown) => {
				assert.strictEqual((error as { code?: string }).code, ProtocolErrorCode.DOCUMENT_NOT_FOUND);
				return true;
			}
		);
		assert.strictEqual(reads, 0);
	});

	test('rejects opening memory while the debug session is running', async () => {
		let evaluations = 0;
		const service = new MemoryDocumentService(
			createSessionTracker({ sessionId: 'session-1', status: 'running' }),
			createDebugGateway({
				evaluateForMemoryReference: async () => {
					evaluations += 1;
					return '0x2000';
				},
			}),
			new DocumentRegistry(),
			() => undefined,
			() => undefined
		);

		await assert.rejects(
			() => service.openDocument({ target: '$sp' }),
			(error: unknown) => {
				assert.strictEqual((error as { code?: string }).code, ProtocolErrorCode.SESSION_NOT_STOPPED);
				return true;
			}
		);
		assert.strictEqual(evaluations, 0);
	});

	test('writes partial memory then returns verification result', async () => {
		const registry = new DocumentRegistry();
		registry.add(createMemoryDocument('doc-1', '0x2000', 'session-1', '0x2000'));
		const service = new MemoryDocumentService(
			createSessionTracker({ sessionId: 'session-1', status: 'stopped' }),
			createDebugGateway({
				writeMemory: async () => ({ offset: 0, bytesWritten: 1, error: 'second byte rejected' }),
				readMemory: async () => ({ address: '0x2000', data: [0xaa], bytesRead: 1, hasUnreadable: false }),
			}),
			registry,
			() => undefined,
			() => undefined
		);

		const result = await service.writeMemory({ documentId: 'doc-1', offset: 0, data: [0xaa, 0xbb] });

		assert.strictEqual(result.bytesWritten, 1);
		assert.strictEqual(result.partial, true);
		assert.strictEqual(result.verified, true);
	});

	test('rejects writes outside the bounded active document before reaching the debugger', async () => {
		const registry = new DocumentRegistry();
		registry.add(createMemoryDocument('doc-1', '0x2000', 'session-1', '0x2000'));
		let writes = 0;
		const service = new MemoryDocumentService(
			createSessionTracker({ sessionId: 'session-1', status: 'stopped' }),
			createDebugGateway({ writeMemory: async () => { writes += 1; return { offset: 0, bytesWritten: 0 }; } }),
			registry,
			() => undefined,
			() => undefined
		);

		await assert.rejects(
			() => service.writeMemory({ documentId: 'doc-1', offset: 0, data: new Array(MAX_MEMORY_WRITE_BYTES + 1).fill(0) }),
			(error: unknown) => (error as { code?: string }).code === ProtocolErrorCode.WRITE_MEMORY_FAILED
		);
		assert.strictEqual(writes, 0);
	});

	test('re-resolves a dynamic document and stores its reference before writing', async () => {
		const registry = new DocumentRegistry();
		registry.add(createMemoryDocument('doc-1', '$sp', 'session-1', '0x0', false));
		let writtenReference = '';
		const service = new MemoryDocumentService(
			createSessionTracker({ sessionId: 'session-1', status: 'stopped' }),
			createDebugGateway({
				evaluateForMemoryReference: async () => '0x3000',
				writeMemory: async (_sessionId, reference) => { writtenReference = reference; return { offset: 0, bytesWritten: 1 }; },
				readMemory: async () => ({ address: '0x3000', data: [0xaa], bytesRead: 1, hasUnreadable: false }),
			}),
			registry,
			() => undefined,
			() => undefined
		);

		const result = await service.writeMemory({ documentId: 'doc-1', offset: 0, data: [0xaa] });

		assert.strictEqual(result.verified, true);
		assert.strictEqual(writtenReference, '0x3000');
		assert.strictEqual(registry.get('doc-1')?.memoryReference, '0x3000');
	});
});
