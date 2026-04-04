import * as vscode from 'vscode';
import type { DebugNavigationMode } from '../../protocol/methods.js';

export type StackScopeWebviewKind = 'memory' | 'call-stack' | 'disassembly' | 'debug-nav';

export function getWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	options: {
		title: string;
		viewKind: StackScopeWebviewKind;
		backgroundColor: string;
		navigationMode?: DebugNavigationMode;
	}
): string {
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
	const nonce = getNonce();
	const navigationMode =
		options.navigationMode ??
		(options.viewKind === 'disassembly'
			? 'disassembly'
			: options.viewKind === 'call-stack' || options.viewKind === 'debug-nav'
				? 'call-stack'
				: null);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
	<title>${options.title}</title>
	<style>
		body {
			margin: 0;
			padding: 0;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background-color: ${options.backgroundColor};
		}
	</style>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}">
		window.__STACKSCOPE_VIEW__ = ${JSON.stringify(options.viewKind)};
		window.__STACKSCOPE_NAV_MODE__ = ${JSON.stringify(navigationMode)};
	</script>
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
