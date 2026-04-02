import * as vscode from 'vscode';
import type { MemoryViewProvider } from '../providers/MemoryViewProvider.js';
import type { HostMessageRouter } from '../bridge/HostMessageRouter.js';

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
	extensionUri: vscode.Uri,
	messageRouter: HostMessageRouter
): vscode.Disposable {
	let panel: vscode.WebviewPanel | null = null;

	return vscode.commands.registerCommand('stackscope.openMemoryViewInEditor', () => {
		if (panel) {
			panel.reveal(vscode.ViewColumn.Beside, true);
			messageRouter.attach(panel.webview);
			return;
		}

		panel = vscode.window.createWebviewPanel(
			'stackscope.memoryView.editor',
			'StackScope Memory',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
			}
		);

		panel.webview.html = getHtmlContent(panel.webview, extensionUri);
		messageRouter.attach(panel.webview);

		panel.onDidDispose(() => {
			messageRouter.detach();
			panel = null;
		});

		panel.onDidChangeViewState(() => {
			if (panel?.active) {
				messageRouter.attach(panel.webview);
			}
		});
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

function getHtmlContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
	const nonce = getNonce();

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
	<title>StackScope Memory</title>
	<style>
		body {
			margin: 0;
			padding: 0;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}
	</style>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
