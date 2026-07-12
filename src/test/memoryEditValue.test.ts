import * as assert from 'assert';
import { formatEditableMemoryValue, parseEditableMemoryValue } from '../webview/memoryEditValue.js';

suite('memoryEditValue', () => {
	test('round-trips a multi-byte little-endian value', () => {
		const bytes = [0x34, 0x12];
		assert.strictEqual(formatEditableMemoryValue(bytes, 'little'), '1234');
		assert.deepStrictEqual(parseEditableMemoryValue('0x1234', 2, 'little'), bytes);
	});

	test('round-trips a 128-bit big-endian value', () => {
		const bytes = Array.from({ length: 16 }, (_value, index) => index);
		const value = formatEditableMemoryValue(bytes, 'big');
		assert.deepStrictEqual(parseEditableMemoryValue(value, 16, 'big'), bytes);
	});

	test('rejects invalid and overflowing values', () => {
		assert.throws(() => parseEditableMemoryValue('xyz', 1, 'little'));
		assert.throws(() => parseEditableMemoryValue('100', 1, 'little'));
	});
});
