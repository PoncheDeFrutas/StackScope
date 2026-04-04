import * as vscode from 'vscode';
import type { MemoryViewProvider } from '../providers/MemoryViewProvider.js';
import type { EditorTabService } from '../services/EditorTabService.js';

/**
 * Creates and registers the "Open Memory View" command.
 * 
 * The command reveals and focuses the StackScope panel view.
 * Address input and document creation are handled within the webview toolbar.
 */
export function createOpenMemoryViewCommand(
	memoryViewProvider: MemoryViewProvider
): vscode.Disposable {
	return vscode.commands.registerCommand('stackscope.openMemoryView', () => {
		memoryViewProvider.focus();
	});
}

/**
 * Creates and registers a command that opens StackScope in an editor tab.
 */
export function createOpenMemoryViewInEditorCommand(
	editorTabService: EditorTabService
): vscode.Disposable {
	return vscode.commands.registerCommand('stackscope.openMemoryViewInEditor', () => {
		editorTabService.openMemory();
	});
}

/**
 * Creates and registers a command that opens StackScope Call Stack in an editor tab.
 */
export function createOpenCallStackInEditorCommand(
	editorTabService: EditorTabService
): vscode.Disposable {
	return vscode.commands.registerCommand('stackscope.openCallStackInEditor', () => {
		editorTabService.openDebugNavigation('call-stack');
	});
}

/**
 * Creates and registers a command that opens StackScope Disassembly in an editor tab.
 */
export function createOpenDisassemblyInEditorCommand(
	editorTabService: EditorTabService
): vscode.Disposable {
	return vscode.commands.registerCommand('stackscope.openDisassemblyInEditor', () => {
		editorTabService.openDebugNavigation('disassembly');
	});
}

/**
 * Creates and registers the "Focus Memory View" command.
 */
export function createFocusMemoryViewCommand(
	memoryViewProvider: MemoryViewProvider
): vscode.Disposable {
	return vscode.commands.registerCommand('stackscope.focusMemoryView', () => {
		memoryViewProvider.focus();
	});
}
