import * as vscode from 'vscode';
import { HostMessageRouter } from '../bridge/HostMessageRouter.js';

/**
 * Webview provider for StackScope memory view panel.
 */
export class MemoryViewProvider {
	private panel: vscode.WebviewPanel | null = null;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly messageRouter: HostMessageRouter
	) {}

	/**
	 * Shows the memory view panel.
	 */
	show(): void {
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.Beside);
			return;
		}

		this.panel = vscode.window.createWebviewPanel(
			'stackscope.memoryView',
			'StackScope Memory',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(this.extensionUri, 'dist'),
				],
			}
		);

		this.panel.webview.html = this.getHtmlContent(this.panel.webview);
		this.messageRouter.attach(this.panel.webview);

		this.panel.onDidDispose(() => {
			this.messageRouter.detach();
			this.panel = null;
		});
	}

	/**
	 * Checks if the panel is currently visible.
	 */
	isVisible(): boolean {
		return this.panel?.visible ?? false;
	}

	/**
	 * Disposes the panel.
	 */
	dispose(): void {
		this.panel?.dispose();
		this.panel = null;
	}

	private getHtmlContent(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
		);

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
}

function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
