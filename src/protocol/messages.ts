import type { ProtocolError } from './errors.js';

/**
 * Base envelope for all protocol messages.
 */
export interface ProtocolMessageBase {
	id: string;
}

/**
 * Request envelope from webview to host.
 */
export interface ProtocolRequest<M extends string, P> extends ProtocolMessageBase {
	type: 'request';
	method: M;
	params: P;
}

/**
 * Successful response envelope from host to webview.
 */
export interface ProtocolResponseSuccess<R> extends ProtocolMessageBase {
	type: 'response';
	success: true;
	result: R;
}

/**
 * Error response envelope from host to webview.
 */
export interface ProtocolResponseError extends ProtocolMessageBase {
	type: 'response';
	success: false;
	error: ProtocolError;
}

/**
 * Response envelope (success or error).
 */
export type ProtocolResponse<R> = ProtocolResponseSuccess<R> | ProtocolResponseError;

/**
 * Event envelope from host to webview.
 */
export interface ProtocolEvent<E extends string, P> {
	type: 'event';
	event: E;
	payload: P;
}

/**
 * Union of all message types.
 */
export type ProtocolMessage =
	| ProtocolRequest<string, unknown>
	| ProtocolResponse<unknown>
	| ProtocolEvent<string, unknown>;
