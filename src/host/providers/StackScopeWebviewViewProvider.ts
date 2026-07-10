import * as vscode from 'vscode';
import {
	getWebviewHtml,
	type StackScopeWebviewKind,
} from '../webview/getWebviewHtml.js';

export interface StackScopeWebviewViewOptions {
	viewType: string;
	title: string;
	viewKind: StackScopeWebviewKind;
	backgroundColor: string;
}

export interface WebviewMessageRouter {
	attach(webview: vscode.Webview): void;
	detach(webview?: vscode.Webview): void;
}

/**
 * Shared lifecycle for StackScope sidebar webviews.
 */
export class StackScopeWebviewViewProvider implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | null = null;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly messageRouter: WebviewMessageRouter,
		private readonly options: StackScopeWebviewViewOptions
	) {}

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
		webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri, {
			title: this.options.title,
			viewKind: this.options.viewKind,
			backgroundColor: this.options.backgroundColor,
		});
		this.messageRouter.attach(webviewView.webview);

		webviewView.onDidDispose(() => {
			this.messageRouter.detach(webviewView.webview);
			this.view = null;
		});
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible && this.view) {
				this.messageRouter.attach(webviewView.webview);
			}
		});
	}

	focus(): void {
		this.view?.show(true);
	}

	isVisible(): boolean {
		return this.view?.visible ?? false;
	}

	dispose(): void {
		if (this.view) {
			this.messageRouter.detach(this.view.webview);
		}
		this.view = null;
	}
}
