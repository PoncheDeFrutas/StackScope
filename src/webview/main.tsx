import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	root.render(<App />);
} else {
	console.error('[StackScope] Root element not found');
}
