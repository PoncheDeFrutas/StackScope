import type { DebugNavigationController } from '../DebugNavigationController.js';
import { setHandler, type HandlerRegistry } from './types.js';

export function registerNavigationHandlers(
	handlers: HandlerRegistry,
	navigation: DebugNavigationController
): void {
	setHandler(handlers, 'listCallStack', async () => navigation.getCallStackSnapshot());
	setHandler(handlers, 'selectStackFrame', (params) => navigation.selectStackFrame(params));
	setHandler(handlers, 'getDisassembly', async () => navigation.getDisassemblySnapshot());
}
