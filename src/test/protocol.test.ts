import * as assert from 'assert';
import {
	ProtocolErrorCode,
	ProtocolRequestError,
	createProtocolError,
	normalizeProtocolError,
} from '../protocol/errors.js';
import { isProtocolEvent, isProtocolResponse } from '../protocol/messages.js';

suite('Protocol contracts', () => {
	test('accepts only complete response envelopes', () => {
		assert.strictEqual(
			isProtocolResponse({ type: 'response', id: '1', success: true, result: {} }),
			true
		);
		assert.strictEqual(
			isProtocolResponse({
				type: 'response',
				id: '2',
				success: false,
				error: { code: ProtocolErrorCode.DOCUMENT_NOT_FOUND, message: 'Missing' },
			}),
			true
		);
		assert.strictEqual(isProtocolResponse({ type: 'response', id: '3', success: true }), false);
		assert.strictEqual(isProtocolResponse({ type: 'response', id: 3, success: true, result: {} }), false);
	});

	test('accepts only complete event envelopes', () => {
		assert.strictEqual(
			isProtocolEvent({ type: 'event', event: 'sessionChanged', payload: {} }),
			true
		);
		assert.strictEqual(isProtocolEvent({ type: 'event', event: 'sessionChanged' }), false);
		assert.strictEqual(isProtocolEvent({ type: 'event', event: 1, payload: {} }), false);
	});

	test('preserves protocol code and details in client errors', () => {
		const error = new ProtocolRequestError(
			createProtocolError(ProtocolErrorCode.INVALID_ADDRESS, 'Invalid address', {
				target: '0xnothex',
			})
		);

		assert.strictEqual(error.name, 'ProtocolRequestError');
		assert.strictEqual(error.message, 'Invalid address');
		assert.strictEqual(error.code, ProtocolErrorCode.INVALID_ADDRESS);
		assert.deepStrictEqual(error.details, { target: '0xnothex' });
	});

	test('normalizes unexpected exceptions at protocol boundary', () => {
		const known = createProtocolError(ProtocolErrorCode.DOCUMENT_NOT_FOUND, 'Missing');

		assert.strictEqual(normalizeProtocolError(known), known);
		assert.deepStrictEqual(normalizeProtocolError(new Error('Adapter failed')), {
			code: ProtocolErrorCode.UNKNOWN_ERROR,
			message: 'Adapter failed',
			details: undefined,
		});
	});
});
