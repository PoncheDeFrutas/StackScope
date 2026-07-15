import * as vscode from 'vscode';
import { createHostServices } from './composition/createHostServices.js';
import { MEMORY_VIEW_TYPE, REGISTER_VIEW_TYPE } from './providers/StackScopeWebviewViewProvider.js';
import { disposeHostErrorReporter } from './services/HostErrorReporter.js';

/**
 * Activates the StackScope extension.
 */
export function activate(context: vscode.ExtensionContext): void {
	console.log('StackScope: Activating...');

	const activeServices = createHostServices(context.extensionUri, context);

	// Register webview view provider for panel
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			MEMORY_VIEW_TYPE,
			activeServices.memoryViewProvider,
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
			activeServices.registerViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			}
		)
	);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('stackscope.openMemoryView', () => activeServices.memoryViewProvider.focus()),
		vscode.commands.registerCommand('stackscope.focusMemoryView', () => activeServices.memoryViewProvider.focus()),
		vscode.commands.registerCommand('stackscope.focusRegistersView', () => activeServices.registerViewProvider.focus()),
		vscode.commands.registerCommand('stackscope.openMemoryViewInEditor', () => activeServices.editorTabService.openMemory()),
		vscode.commands.registerCommand('stackscope.openCallStackInEditor', () => activeServices.editorTabService.openDebugNavigation('call-stack')),
		vscode.commands.registerCommand('stackscope.openDisassemblyInEditor', () => activeServices.editorTabService.openDebugNavigation('disassembly'))
	);

	// Register session tracker for cleanup
	context.subscriptions.push({
		dispose: () => activeServices.sessionTracker.dispose(),
	});

	// Register provider for cleanup
	context.subscriptions.push({
		dispose: () => activeServices.memoryViewProvider.dispose(),
	});
	context.subscriptions.push({
		dispose: () => activeServices.registerViewProvider.dispose(),
	});

	context.subscriptions.push({
		dispose: () => activeServices.editorTabService.dispose(),
	});
	context.subscriptions.push({ dispose: disposeHostErrorReporter });
	context.subscriptions.push(activeServices.capabilities);

	console.log('StackScope: Activated');
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {
	console.log('StackScope: Deactivating...');
}
