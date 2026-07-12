import type * as vscode from 'vscode';
import { VscodeSessionTracker } from '../../debug/vscode/VscodeSessionTracker.js';
import { DapDebugGateway } from '../../debug/dap/DapDebugGateway.js';
import { DapCapabilitiesService } from '../../debug/dap/DapCapabilitiesService.js';
import { DocumentRegistry } from '../../domain/documents/DocumentRegistry.js';
import { HostMessageRouter } from '../bridge/HostMessageRouter.js';
import { MemoryViewProvider } from '../providers/MemoryViewProvider.js';
import { RegisterViewProvider } from '../providers/RegisterViewProvider.js';
import { PresetService } from '../services/PresetService.js';
import { RegisterSetService } from '../services/RegisterSetService.js';
import { StackSelectionService } from '../services/StackSelectionService.js';
import { ViewStateService } from '../services/ViewStateService.js';
import { EditorTabService } from '../services/EditorTabService.js';
import { DebugMutationService } from '../services/DebugMutationService.js';

/**
 * Container for all host-level services.
 */
export interface HostServices {
	sessionTracker: VscodeSessionTracker;
	debugGateway: DapDebugGateway;
	capabilities: DapCapabilitiesService;
	debugMutations: DebugMutationService;
	documentRegistry: DocumentRegistry;
	presetService: PresetService;
	registerSetService: RegisterSetService;
	stackSelectionService: StackSelectionService;
	viewStateService: ViewStateService;
	editorTabService: EditorTabService;
	messageRouter: HostMessageRouter;
	memoryViewProvider: MemoryViewProvider;
	registerViewProvider: RegisterViewProvider;
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
	const capabilities = new DapCapabilitiesService();
	const debugMutations = new DebugMutationService();
	const debugGateway = new DapDebugGateway({}, capabilities);
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
		viewStateService,
		capabilities,
		debugMutations
	);
	editorTabService.setRouter(messageRouter);
	const memoryViewProvider = new MemoryViewProvider(extensionUri, messageRouter);
	const registerViewProvider = new RegisterViewProvider(extensionUri, messageRouter);

	return {
		sessionTracker,
		debugGateway,
		capabilities,
		debugMutations,
		documentRegistry,
		presetService,
		registerSetService,
		stackSelectionService,
		viewStateService,
		editorTabService,
		messageRouter,
		memoryViewProvider,
		registerViewProvider,
	};
}
