import * as assert from 'assert';
import { formatEditableMemoryValue, parseEditableMemoryValue } from '../webview/memoryEditValue.js';

suite('memoryEditValue', () => {
	test('round-trips a multi-byte little-endian value', () => {
		const bytes = [0x34, 0x12];
		assert.strictEqual(formatEditableMemoryValue(bytes, 'little'), '1234');
		assert.deepStrictEqual(parseEditableMemoryValue('0x1234', 2, 'little'), bytes);
	});

	test('parses decimal, octal, and binary numeric input', () => {
		assert.deepStrictEqual(parseEditableMemoryValue('4660', 2, 'big', 'dec'), [0x12, 0x34]);
		assert.deepStrictEqual(parseEditableMemoryValue('0o11064', 2, 'big', 'oct'), [0x12, 0x34]);
		assert.deepStrictEqual(parseEditableMemoryValue('0b1001000110100', 2, 'big', 'bin'), [0x12, 0x34]);
		assert.strictEqual(formatEditableMemoryValue([0x12, 0x34], 'big', 'dec'), '4660');
	});

	test('writes only entered ASCII bytes', () => {
		assert.deepStrictEqual(parseEditableMemoryValue('ABC', 4, 'little', 'ascii'), [0x41, 0x42, 0x43]);
		assert.strictEqual(formatEditableMemoryValue([0x41, 0x42, 0x43], 'little', 'ascii'), 'ABC');
	});

	test('round-trips a 128-bit big-endian value', () => {
		const bytes = Array.from({ length: 16 }, (_value, index) => index);
		const value = formatEditableMemoryValue(bytes, 'big');
		assert.deepStrictEqual(parseEditableMemoryValue(value, 16, 'big'), bytes);
	});

	test('rejects invalid and overflowing values', () => {
		assert.throws(() => parseEditableMemoryValue('xyz', 1, 'little'));
		assert.throws(() => parseEditableMemoryValue('100', 1, 'little'));
		assert.throws(() => parseEditableMemoryValue('2', 1, 'little', 'bin'));
		assert.throws(() => parseEditableMemoryValue('ABCD', 3, 'little', 'ascii'));
		assert.throws(() => parseEditableMemoryValue('á', 2, 'little', 'ascii'));
	});
});
