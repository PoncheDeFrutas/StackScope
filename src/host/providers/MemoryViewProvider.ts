import * as vscode from 'vscode';
import { HostMessageRouter } from '../bridge/HostMessageRouter.js';
import { getWebviewHtml } from '../webview/getWebviewHtml.js';

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
			this.messageRouter.detach(webviewView.webview);
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
		if (this.view) {
			this.messageRouter.detach(this.view.webview);
		}
		this.view = null;
	}

	private getHtmlContent(webview: vscode.Webview): string {
		return getWebviewHtml(webview, this.extensionUri, {
			title: 'StackScope Memory',
			viewKind: 'memory',
			backgroundColor: 'var(--vscode-panel-background, var(--vscode-editor-background))',
		});
	}
}
