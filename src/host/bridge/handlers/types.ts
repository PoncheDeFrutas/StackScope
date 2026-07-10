import type { MethodMap, MethodName } from '../../../protocol/methods.js';

export type MethodHandler<M extends MethodName> = (
	params: MethodMap[M]['params']
) => Promise<MethodMap[M]['result']>;

export type HandlerRegistry = Map<string, MethodHandler<MethodName>>;

export function setHandler<M extends MethodName>(
	handlers: HandlerRegistry,
	method: M,
	handler: MethodHandler<M>
): void {
	handlers.set(method, handler as unknown as MethodHandler<MethodName>);
}
