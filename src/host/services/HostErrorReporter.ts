import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | null = null;

/** Records host-side failures in one inspectable VS Code output channel. */
export function reportHostError(scope: string, error: unknown): void {
	const message = error instanceof Error ? error.message : String(error);
	const detail = error instanceof Error && error.stack ? `\n${error.stack}` : '';
	const line = `[${new Date().toISOString()}] ${scope}: ${message}${detail}`;

	console.error(`[StackScope] ${scope}:`, error);
	try {
		getOutputChannel().appendLine(line);
	} catch {
		// Reporting must not obscure the original operation failure.
	}
}

export function disposeHostErrorReporter(): void {
	outputChannel?.dispose();
	outputChannel = null;
}

function getOutputChannel(): vscode.OutputChannel {
	outputChannel ??= vscode.window.createOutputChannel('StackScope');
	return outputChannel;
}
