import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	StackScopeWebviewViewProvider,
	type WebviewMessageRouter,
} from '../host/providers/StackScopeWebviewViewProvider.js';

suite('StackScopeWebviewViewProvider', () => {
	test('attaches on resolve and reattaches when visible', () => {
		const router = new FakeRouter();
		const view = createView();
		const provider = createProvider(router);

		provider.resolveWebviewView(
			view.webviewView,
			{} as vscode.WebviewViewResolveContext,
			{} as vscode.CancellationToken
		);
		assert.strictEqual(router.attached.length, 1);
		assert.strictEqual(view.options?.enableScripts, true);
		assert.match(view.html, /__STACKSCOPE_VIEW__/);

		view.setVisible(true);
		assert.strictEqual(router.attached.length, 2);
	});

	test('focuses, detaches on dispose, and avoids duplicate provider disposal', () => {
		const router = new FakeRouter();
		const view = createView();
		const provider = createProvider(router);
		provider.resolveWebviewView(
			view.webviewView,
			{} as vscode.WebviewViewResolveContext,
			{} as vscode.CancellationToken
		);

		provider.focus();
		assert.deepStrictEqual(view.showCalls, [true]);

		view.dispose();
		provider.dispose();
		assert.deepStrictEqual(router.detached, [view.webview]);
	});
});

class FakeRouter implements WebviewMessageRouter {
	readonly attached: vscode.Webview[] = [];
	readonly detached: vscode.Webview[] = [];

	attach(webview: vscode.Webview): void {
		this.attached.push(webview);
	}

	detach(webview?: vscode.Webview): void {
		if (webview) {
			this.detached.push(webview);
		}
	}
}

function createProvider(router: WebviewMessageRouter): StackScopeWebviewViewProvider {
	return new StackScopeWebviewViewProvider(vscode.Uri.file('/extension'), router, {
		viewType: 'stackscope.testView',
		title: 'StackScope Test',
		viewKind: 'memory',
		backgroundColor: 'var(--vscode-editor-background)',
	});
}

function createView(): {
	webview: vscode.Webview;
	webviewView: vscode.WebviewView;
	options: vscode.WebviewOptions | undefined;
	html: string;
	showCalls: boolean[];
	setVisible: (visible: boolean) => void;
	dispose: () => void;
} {
	let disposeListener: (() => void) | undefined;
	let visibilityListener: (() => void) | undefined;
	const result = {
		webview: null as unknown as vscode.Webview,
		webviewView: null as unknown as vscode.WebviewView,
		options: undefined as vscode.WebviewOptions | undefined,
		html: '',
		showCalls: [] as boolean[],
		setVisible: (visible: boolean) => {
			(result.webviewView as unknown as { visible: boolean }).visible = visible;
			visibilityListener?.();
		},
		dispose: () => disposeListener?.(),
	};
	result.webview = {
		asWebviewUri: (uri: vscode.Uri) => uri,
		set options(value: vscode.WebviewOptions) {
			result.options = value;
		},
		get options() {
			return result.options ?? {};
		},
		set html(value: string) {
			result.html = value;
		},
		get html() {
			return result.html;
		},
	} as unknown as vscode.Webview;
	result.webviewView = {
		webview: result.webview,
		visible: true,
		show: (preserveFocus?: boolean) => result.showCalls.push(Boolean(preserveFocus)),
		onDidDispose: (listener: () => void) => {
			disposeListener = listener;
			return { dispose: () => undefined };
		},
		onDidChangeVisibility: (listener: () => void) => {
			visibilityListener = listener;
			return { dispose: () => undefined };
		},
	} as unknown as vscode.WebviewView;
	return result;
}
