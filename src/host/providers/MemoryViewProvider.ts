import * as vscode from 'vscode';
import { HostMessageRouter } from '../bridge/HostMessageRouter.js';

/**
 * Webview view provider for StackScope memory panel.
 * Registers as a panel view (alongside Terminal, Debug Console, etc.)
 */
export class MemoryViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'stackscope.memoryView';

	private view: vscode.WebviewView | null = null;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly messageRouter: HostMessageRouter
	) {}

	/**
	 * Called when the view is first shown.
	 */
	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
		};

		webviewView.webview.html = this.getHtmlContent(webviewView.webview);
		this.messageRouter.attach(webviewView.webview);

		webviewView.onDidDispose(() => {
			this.messageRouter.detach();
			this.view = null;
		});

		// Re-attach when view becomes visible again
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible && this.view) {
				this.messageRouter.attach(webviewView.webview);
			}
		});
	}

	/**
	 * Reveals/focuses the panel view.
	 */
	focus(): void {
		if (this.view) {
			this.view.show(true);
		}
	}

	/**
	 * Checks if the view is currently visible.
	 */
	isVisible(): boolean {
		return this.view?.visible ?? false;
	}

	/**
	 * Disposes the provider.
	 */
	dispose(): void {
		this.messageRouter.detach();
		this.view = null;
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
			background-color: var(--vscode-panel-background, var(--vscode-editor-background));
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
