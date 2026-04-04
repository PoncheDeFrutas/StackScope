import * as vscode from 'vscode';
import type { ProtocolEvent } from '../../protocol/messages.js';
import type { DebugNavigationMode } from '../../protocol/methods.js';
import type { DebugNavigationModeChangedPayload } from '../../protocol/events.js';
import { getWebviewHtml } from '../webview/getWebviewHtml.js';

export interface WebviewRouterBridge {
	attach(webview: vscode.Webview): void;
	detach(webview?: vscode.Webview): void;
}

/**
 * Manages singleton editor-tab webviews for StackScope.
 */
export class EditorTabService {
	private router: WebviewRouterBridge | null = null;
	private memoryPanel: vscode.WebviewPanel | null = null;
	private debugNavigationPanel: vscode.WebviewPanel | null = null;

	constructor(private readonly extensionUri: vscode.Uri) {}

	setRouter(router: WebviewRouterBridge): void {
		this.router = router;
	}

	openMemory(): void {
		const existing = this.memoryPanel;
		if (existing) {
			existing.reveal(vscode.ViewColumn.Beside, true);
			this.router?.attach(existing.webview);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'stackscope.memoryView.editor',
			'StackScope Memory',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
			}
		);

		panel.webview.html = getWebviewHtml(panel.webview, this.extensionUri, {
			title: 'StackScope Memory',
			viewKind: 'memory',
			backgroundColor: 'var(--vscode-editor-background)',
		});

		this.memoryPanel = panel;
		this.router?.attach(panel.webview);
		this.registerLifecycle(panel, 'memory');
	}

	openDebugNavigation(mode: DebugNavigationMode): void {
		const existing = this.debugNavigationPanel;
		if (existing) {
			existing.reveal(vscode.ViewColumn.Beside, true);
			this.router?.attach(existing.webview);
			void this.postDebugNavigationMode(existing.webview, mode);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'stackscope.debugNavigation.editor',
			'StackScope Debug Navigation',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
			}
		);

		panel.webview.html = getWebviewHtml(panel.webview, this.extensionUri, {
			title: 'StackScope Debug Navigation',
			viewKind: 'debug-nav',
			backgroundColor: 'var(--vscode-editor-background)',
			navigationMode: mode,
		});

		this.debugNavigationPanel = panel;
		this.router?.attach(panel.webview);
		this.registerLifecycle(panel, 'debug-navigation');
	}

	dispose(): void {
		this.memoryPanel?.dispose();
		this.debugNavigationPanel?.dispose();
		this.memoryPanel = null;
		this.debugNavigationPanel = null;
	}

	private registerLifecycle(
		panel: vscode.WebviewPanel,
		kind: 'memory' | 'debug-navigation'
	): void {
		panel.onDidDispose(() => {
			this.router?.detach(panel.webview);
			if (kind === 'memory') {
				this.memoryPanel = null;
			} else {
				this.debugNavigationPanel = null;
			}
		});

		panel.onDidChangeViewState(() => {
			if (panel.active) {
				this.router?.attach(panel.webview);
			}
		});
	}

	private async postDebugNavigationMode(
		webview: vscode.Webview,
		mode: DebugNavigationMode
	): Promise<void> {
		const message: ProtocolEvent<'debugNavigationModeChanged', DebugNavigationModeChangedPayload> = {
			type: 'event',
			event: 'debugNavigationModeChanged',
			payload: { mode },
		};
		await webview.postMessage(message);
	}
}
