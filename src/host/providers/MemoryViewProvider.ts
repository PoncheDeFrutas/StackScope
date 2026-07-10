import * as vscode from 'vscode';
import { HostMessageRouter } from '../bridge/HostMessageRouter.js';
import { StackScopeWebviewViewProvider } from './StackScopeWebviewViewProvider.js';

export class MemoryViewProvider extends StackScopeWebviewViewProvider {
	public static readonly viewType = 'stackscope.memoryView';

	constructor(extensionUri: vscode.Uri, messageRouter: HostMessageRouter) {
		super(extensionUri, messageRouter, {
			viewType: MemoryViewProvider.viewType,
			title: 'StackScope Memory',
			viewKind: 'memory',
			backgroundColor: 'var(--vscode-panel-background, var(--vscode-editor-background))',
		});
	}
}
