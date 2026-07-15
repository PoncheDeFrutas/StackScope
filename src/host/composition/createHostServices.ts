import type * as vscode from 'vscode';
import { VscodeSessionTracker } from '../../debug/vscode/VscodeSessionTracker.js';
import { DapDebugGateway } from '../../debug/dap/DapDebugGateway.js';
import { DapCapabilitiesService } from '../../debug/dap/DapCapabilitiesService.js';
import { DocumentRegistry } from '../../domain/documents/DocumentRegistry.js';
import { HostMessageRouter } from '../bridge/HostMessageRouter.js';
import { StackScopeWebviewViewProvider } from '../providers/StackScopeWebviewViewProvider.js';
import { PresetService } from '../services/PresetService.js';
import { RegisterSetService } from '../services/RegisterSetService.js';
import { StackSelectionService } from '../services/StackSelectionService.js';
import { ViewStateService } from '../services/ViewStateService.js';
import { EditorTabService } from '../services/EditorTabService.js';
import { DebugMutationService } from '../services/DebugMutationService.js';
import { DataWatchpointService } from '../services/DataWatchpointService.js';

/**
 * Creates and wires all host services.
 * This is the composition root — no business logic here.
 */
export function createHostServices(
	extensionUri: vscode.Uri,
	context: vscode.ExtensionContext
) {
	const sessionTracker = new VscodeSessionTracker();
	const capabilities = new DapCapabilitiesService();
	const debugMutations = new DebugMutationService();
	const debugGateway = new DapDebugGateway(capabilities);
	const documentRegistry = new DocumentRegistry();
	const presetService = new PresetService(context);
	const registerSetService = new RegisterSetService(context);
	const stackSelectionService = new StackSelectionService();
	const dataWatchpoints = new DataWatchpointService(
		sessionTracker,
		debugGateway,
		capabilities,
		debugMutations,
		(sessionId) => {
			const selection = stackSelectionService.get();
			return selection.sessionId === sessionId ? selection.frameId ?? undefined : undefined;
		}
	);
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
		debugMutations,
		dataWatchpoints
	);
	editorTabService.setRouter(messageRouter);
	const memoryViewProvider = new StackScopeWebviewViewProvider(extensionUri, messageRouter, {
		title: 'StackScope Memory',
		viewKind: 'memory',
		backgroundColor: 'var(--vscode-panel-background, var(--vscode-editor-background))',
	});
	const registerViewProvider = new StackScopeWebviewViewProvider(extensionUri, messageRouter, {
		title: 'StackScope Registers',
		viewKind: 'registers',
		backgroundColor: 'var(--vscode-sideBar-background, var(--vscode-editor-background))',
	});

	return {
		sessionTracker,
		debugGateway,
		capabilities,
		debugMutations,
		dataWatchpoints,
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
