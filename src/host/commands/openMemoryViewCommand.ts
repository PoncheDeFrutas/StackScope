import * as vscode from 'vscode';
import type { MemoryViewProvider } from '../providers/MemoryViewProvider.js';

/**
 * Creates and registers the "Open Memory View" command.
 * 
 * The command simply opens the StackScope panel. Address input and document
 * creation are handled within the webview toolbar.
 */
export function createOpenMemoryViewCommand(
	memoryViewProvider: MemoryViewProvider
): vscode.Disposable {
	return vscode.commands.registerCommand('stackscope.openMemoryView', () => {
		memoryViewProvider.show();
	});
}
