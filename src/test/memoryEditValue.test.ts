import * as assert from 'assert';
import {
	formatEditableMemoryValue,
	inferRegisterByteLength,
	parseEditableMemoryValue,
	parseRegisterInputValue,
} from '../webview/memoryEditValue.js';

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

	test('infers common register widths and falls back for unpadded zero', () => {
		assert.strictEqual(inferRegisterByteLength('0xFF'), 1);
		assert.strictEqual(inferRegisterByteLength('0x00000000'), 4);
		assert.strictEqual(inferRegisterByteLength('0x0000000000000000'), 8);
		assert.strictEqual(inferRegisterByteLength('0x0'), 8);
	});

	test('encodes register input as canonical hexadecimal expressions', () => {
		assert.deepStrictEqual(parseRegisterInputValue('4660', 2, 'big', 'dec'), {
			expression: '0x1234', bytes: [0x12, 0x34],
		});
		assert.deepStrictEqual(parseRegisterInputValue('ABC', 4, 'little', 'ascii'), {
			expression: '0x00434241', bytes: [0x41, 0x42, 0x43, 0x00],
		});
		assert.deepStrictEqual(parseRegisterInputValue('$pc + 4', 8, 'little', 'raw'), {
			expression: '$pc + 4', bytes: null,
		});
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
