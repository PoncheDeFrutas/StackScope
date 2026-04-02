import * as vscode from 'vscode';
import { createHostServices, type HostServices } from './composition/createHostServices.js';
import {
	createOpenMemoryViewCommand,
	createFocusMemoryViewCommand,
	createOpenMemoryViewInEditorCommand,
} from './commands/openMemoryViewCommand.js';
import { MemoryViewProvider } from './providers/MemoryViewProvider.js';

let services: HostServices | null = null;

/**
 * Activates the StackScope extension.
 */
export function activate(context: vscode.ExtensionContext): void {
	console.log('StackScope: Activating...');

	services = createHostServices(context.extensionUri, context);

	// Register webview view provider for panel
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			MemoryViewProvider.viewType,
			services.memoryViewProvider,
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
		createOpenMemoryViewInEditorCommand(context.extensionUri, services.messageRouter)
	);

	// Register session tracker for cleanup
	context.subscriptions.push({
		dispose: () => services?.sessionTracker.dispose(),
	});

	// Register provider for cleanup
	context.subscriptions.push({
		dispose: () => services?.memoryViewProvider.dispose(),
	});

	console.log('StackScope: Activated');
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {
	console.log('StackScope: Deactivating...');
	services = null;
}
