import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { DebugNavigationApp } from './DebugNavigationApp.js';
import type { DebugNavigationMode } from '../protocol/methods.js';

declare global {
	interface Window {
		__STACKSCOPE_VIEW__?: 'memory' | 'call-stack' | 'disassembly' | 'debug-nav';
		__STACKSCOPE_NAV_MODE__?: DebugNavigationMode | null;
	}
}

const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	switch (window.__STACKSCOPE_VIEW__) {
		case 'call-stack':
		case 'disassembly':
		case 'debug-nav':
			root.render(<DebugNavigationApp />);
			break;
		default:
			root.render(<App />);
			break;
	}
} else {
	console.error('[StackScope] Root element not found');
}
