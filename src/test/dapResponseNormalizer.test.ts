import * as assert from 'assert';
import {
	createUnreadableMemoryResult,
	getDapErrorMessage,
	normalizeReadMemoryResponse,
} from '../debug/dap/DapResponseNormalizer.js';

suite('DAP response normalizer', () => {
	test('decodes partial memory response and pads unreadable bytes', () => {
		const result = normalizeReadMemoryResponse('0x1000', 0, 4, {
			address: '0x1000',
			data: 'AQI=',
		});

		assert.deepStrictEqual(result, {
			address: '0x1000',
			data: [1, 2, null, null],
			bytesRead: 2,
			hasUnreadable: true,
		});
	});

	test('creates unreadable result at numeric offset', () => {
		assert.deepStrictEqual(createUnreadableMemoryResult('0x1000', 16, 2), {
			address: '0x1010',
			data: [null, null],
			bytesRead: 0,
			hasUnreadable: true,
		});
	});

	test('keeps error message for Error and non-Error failures', () => {
		assert.strictEqual(getDapErrorMessage(new Error('Adapter failed')), 'Adapter failed');
		assert.strictEqual(getDapErrorMessage('Adapter failed'), 'Adapter failed');
	});
});
