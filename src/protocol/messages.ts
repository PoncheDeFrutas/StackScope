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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function isProtocolResponse(value: unknown): value is ProtocolResponse<unknown> {
	if (
		!isRecord(value) ||
		value.type !== 'response' ||
		typeof value.id !== 'string' ||
		typeof value.success !== 'boolean'
	) {
		return false;
	}

	if (value.success) {
		return 'result' in value;
	}

	return (
		isRecord(value.error) &&
		typeof value.error.code === 'string' &&
		typeof value.error.message === 'string'
	);
}

export function isProtocolEvent(value: unknown): value is ProtocolEvent<string, unknown> {
	return (
		isRecord(value) &&
		value.type === 'event' &&
		typeof value.event === 'string' &&
		'payload' in value
	);
}
