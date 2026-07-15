import * as vscode from 'vscode';
import { createHostServices } from './composition/createHostServices.js';
import {
	createOpenMemoryViewCommand,
	createFocusMemoryViewCommand,
	createOpenMemoryViewInEditorCommand,
	createOpenCallStackInEditorCommand,
	createOpenDisassemblyInEditorCommand,
	createFocusRegistersViewCommand,
} from './commands/openMemoryViewCommand.js';
import { MEMORY_VIEW_TYPE, REGISTER_VIEW_TYPE } from './providers/StackScopeWebviewViewProvider.js';
import { disposeHostErrorReporter } from './services/HostErrorReporter.js';

let services: ReturnType<typeof createHostServices> | null = null;

/**
 * Activates the StackScope extension.
 */
export function activate(context: vscode.ExtensionContext): void {
	console.log('StackScope: Activating...');

	services = createHostServices(context.extensionUri, context);

	// Register webview view provider for panel
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			MEMORY_VIEW_TYPE,
			services.memoryViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			}
		)
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			REGISTER_VIEW_TYPE,
			services.registerViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			}
		)
	);

	// Register commands
	context.subscriptions.push(
		createOpenMemoryViewCommand(services.memoryViewProvider),
		createFocusMemoryViewCommand(services.memoryViewProvider),
		createFocusRegistersViewCommand(services.registerViewProvider),
		createOpenMemoryViewInEditorCommand(services.editorTabService),
		createOpenCallStackInEditorCommand(services.editorTabService),
		createOpenDisassemblyInEditorCommand(services.editorTabService)
	);

	// Register session tracker for cleanup
	context.subscriptions.push({
		dispose: () => services?.sessionTracker.dispose(),
	});

	// Register provider for cleanup
	context.subscriptions.push({
		dispose: () => services?.memoryViewProvider.dispose(),
	});
	context.subscriptions.push({
		dispose: () => services?.registerViewProvider.dispose(),
	});

	context.subscriptions.push({
		dispose: () => services?.editorTabService.dispose(),
	});
	context.subscriptions.push({ dispose: disposeHostErrorReporter });
	context.subscriptions.push(services.capabilities);

	console.log('StackScope: Activated');
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {
	console.log('StackScope: Deactivating...');
	services = null;
}
