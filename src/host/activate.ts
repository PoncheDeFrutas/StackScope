import * as vscode from 'vscode';
import { createHostServices, type HostServices } from './composition/createHostServices.js';
import { createOpenMemoryViewCommand } from './commands/openMemoryViewCommand.js';

let services: HostServices | null = null;

/**
 * Activates the StackScope extension.
 */
export function activate(context: vscode.ExtensionContext): void {
	console.log('StackScope: Activating...');

	services = createHostServices(context.extensionUri);

	// Register commands
	context.subscriptions.push(
		createOpenMemoryViewCommand(
			services.sessionTracker,
			services.debugGateway,
			services.documentRegistry,
			services.memoryViewProvider
		)
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
