import type * as vscode from 'vscode';
import { VscodeSessionTracker } from '../../debug/vscode/VscodeSessionTracker.js';
import { DapDebugGateway } from '../../debug/dap/DapDebugGateway.js';
import { DocumentRegistry } from '../../domain/documents/DocumentRegistry.js';
import { HostMessageRouter } from '../bridge/HostMessageRouter.js';
import { MemoryViewProvider } from '../providers/MemoryViewProvider.js';

/**
 * Container for all host-level services.
 */
export interface HostServices {
	sessionTracker: VscodeSessionTracker;
	debugGateway: DapDebugGateway;
	documentRegistry: DocumentRegistry;
	messageRouter: HostMessageRouter;
	memoryViewProvider: MemoryViewProvider;
}

/**
 * Creates and wires all host services.
 * This is the composition root — no business logic here.
 */
export function createHostServices(extensionUri: vscode.Uri): HostServices {
	const sessionTracker = new VscodeSessionTracker();
	const debugGateway = new DapDebugGateway();
	const documentRegistry = new DocumentRegistry();
	const messageRouter = new HostMessageRouter(
		sessionTracker,
		debugGateway,
		documentRegistry
	);
	const memoryViewProvider = new MemoryViewProvider(extensionUri, messageRouter);

	return {
		sessionTracker,
		debugGateway,
		documentRegistry,
		messageRouter,
		memoryViewProvider,
	};
}
