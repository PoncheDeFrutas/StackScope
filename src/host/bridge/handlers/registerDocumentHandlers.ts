import type { MemoryDocumentService } from '../../services/MemoryDocumentService.js';
import { setHandler, type HandlerRegistry } from './types.js';

export function registerDocumentHandlers(
	handlers: HandlerRegistry,
	documentService: MemoryDocumentService
): void {
	setHandler(handlers, 'readMemory', (params) => documentService.readMemory(params));
	setHandler(handlers, 'writeMemory', (params) => documentService.writeMemory(params));
	setHandler(handlers, 'openDocument', (params) => documentService.openDocument(params));
	setHandler(handlers, 'listDocuments', async () => documentService.listDocuments());
	setHandler(handlers, 'selectDocument', async (params) => documentService.selectDocument(params));
	setHandler(handlers, 'closeDocument', async (params) => documentService.closeDocument(params));
	setHandler(handlers, 'updateDocument', async (params) => documentService.updateDocument(params));
}
