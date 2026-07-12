import * as assert from 'assert';
import { formatMemoryAddress, parseMemoryAddress } from '../webview/memoryAddress.js';

suite('memoryAddress', () => {
	test('parses supported address forms', () => {
		assert.strictEqual(parseMemoryAddress('0x20000000'), 0x20000000n);
		assert.strictEqual(parseMemoryAddress('536870912'), 0x20000000n);
		assert.strictEqual(parseMemoryAddress('  DEADBEEF  '), 0xDEADBEEFn);
	});

	test('uses zero for invalid addresses', () => {
		assert.strictEqual(parseMemoryAddress('not-an-address'), 0n);
		assert.strictEqual(parseMemoryAddress(''), 0n);
	});

	test('formats fixed-width uppercase addresses', () => {
		assert.strictEqual(formatMemoryAddress(0xDEADBEEFn), '0x00000000DEADBEEF');
	});
});
