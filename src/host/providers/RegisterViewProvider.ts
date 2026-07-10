import * as vscode from 'vscode';
import { HostMessageRouter } from '../bridge/HostMessageRouter.js';
import { StackScopeWebviewViewProvider } from './StackScopeWebviewViewProvider.js';

export class RegisterViewProvider extends StackScopeWebviewViewProvider {
	public static readonly viewType = 'stackscope.registersView';

	constructor(extensionUri: vscode.Uri, messageRouter: HostMessageRouter) {
		super(extensionUri, messageRouter, {
			viewType: RegisterViewProvider.viewType,
			title: 'StackScope Registers',
			viewKind: 'registers',
			backgroundColor: 'var(--vscode-sideBar-background, var(--vscode-editor-background))',
		});
	}
}
