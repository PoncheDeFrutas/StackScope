import type * as vscode from 'vscode';
import { VscodeSessionTracker } from '../../debug/vscode/VscodeSessionTracker.js';
import { DapDebugGateway } from '../../debug/dap/DapDebugGateway.js';
import { DocumentRegistry } from '../../domain/documents/DocumentRegistry.js';
import { HostMessageRouter } from '../bridge/HostMessageRouter.js';
import { MemoryViewProvider } from '../providers/MemoryViewProvider.js';
import { PresetService } from '../services/PresetService.js';
import { RegisterSetService } from '../services/RegisterSetService.js';
import { StackSelectionService } from '../services/StackSelectionService.js';
import { ViewStateService } from '../services/ViewStateService.js';
import { EditorTabService } from '../services/EditorTabService.js';

/**
 * Container for all host-level services.
 */
export interface HostServices {
	sessionTracker: VscodeSessionTracker;
	debugGateway: DapDebugGateway;
	documentRegistry: DocumentRegistry;
	presetService: PresetService;
	registerSetService: RegisterSetService;
	stackSelectionService: StackSelectionService;
	viewStateService: ViewStateService;
	editorTabService: EditorTabService;
	messageRouter: HostMessageRouter;
	memoryViewProvider: MemoryViewProvider;
}

/**
 * Creates and wires all host services.
 * This is the composition root — no business logic here.
 */
export function createHostServices(
	extensionUri: vscode.Uri,
	context: vscode.ExtensionContext
): HostServices {
	const sessionTracker = new VscodeSessionTracker();
	const debugGateway = new DapDebugGateway();
	const documentRegistry = new DocumentRegistry();
	const presetService = new PresetService(context);
	const registerSetService = new RegisterSetService(context);
	const stackSelectionService = new StackSelectionService();
	const viewStateService = new ViewStateService(context);
	const editorTabService = new EditorTabService(extensionUri);
	const messageRouter = new HostMessageRouter(
		sessionTracker,
		debugGateway,
		documentRegistry,
		presetService,
		registerSetService,
		stackSelectionService,
		viewStateService
	);
	editorTabService.setRouter(messageRouter);
	const memoryViewProvider = new MemoryViewProvider(extensionUri, messageRouter);

	return {
		sessionTracker,
		debugGateway,
		documentRegistry,
		presetService,
		registerSetService,
		stackSelectionService,
		viewStateService,
		editorTabService,
		messageRouter,
		memoryViewProvider,
	};
}
