import * as vscode from 'vscode';
import type { DebugGateway } from '../../debug/contracts/DebugGateway.js';
import type { SessionTracker } from '../../debug/contracts/SessionTracker.js';
import type { DocumentRegistry } from '../../domain/documents/DocumentRegistry.js';
import { createMemoryDocument } from '../../domain/documents/MemoryDocument.js';
import { generateDocumentId } from '../../shared/ids.js';
import type { MemoryViewProvider } from '../providers/MemoryViewProvider.js';

/**
 * Creates and registers the "Open Memory View" command.
 */
export function createOpenMemoryViewCommand(
	sessionTracker: SessionTracker,
	debugGateway: DebugGateway,
	documentRegistry: DocumentRegistry,
	memoryViewProvider: MemoryViewProvider
): vscode.Disposable {
	return vscode.commands.registerCommand('stackscope.openMemoryView', async () => {
		// Refresh session state to get accurate status
		const state = await sessionTracker.refresh();

		// Check for active session
		if (!state.sessionId) {
			vscode.window.showWarningMessage(
				'StackScope: No active debug session. Start a debug session first.'
			);
			return;
		}

		// Check if session is stopped (required for memory operations)
		if (state.status !== 'stopped') {
			vscode.window.showWarningMessage(
				'StackScope: Debug session must be paused to read memory. Hit a breakpoint or pause execution.'
			);
			return;
		}

		// Prompt for address
		const address = await vscode.window.showInputBox({
			prompt: 'Enter memory address (hex) or expression',
			placeHolder: '0x20000000',
			value: '0x0',
			validateInput: (value) => {
				const trimmed = value.trim();
				if (!trimmed) {
					return 'Address cannot be empty';
				}
				return null;
			},
		});

		if (!address) {
			return; // User cancelled
		}

		// Resolve the address to a memory reference
		const memoryReference = await debugGateway.evaluateForMemoryReference(
			state.sessionId,
			address.trim()
		);

		if (!memoryReference) {
			vscode.window.showErrorMessage(
				`StackScope: Could not resolve address "${address}". Try a hex address like 0x20000000 or a valid pointer expression.`
			);
			return;
		}

		// Create memory document
		const doc = createMemoryDocument(
			generateDocumentId(),
			address.trim(),
			state.sessionId,
			memoryReference
		);

		documentRegistry.add(doc);
		documentRegistry.setActive(doc.id);

		// Show the panel
		memoryViewProvider.show();
	});
}
