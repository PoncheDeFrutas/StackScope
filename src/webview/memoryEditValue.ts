import type { Endianness } from '../domain/config/MemoryViewConfig.js';

export function formatEditableMemoryValue(bytes: readonly number[], endianness: Endianness): string {
	const ordered = endianness === 'little' ? [...bytes].reverse() : bytes;
	let value = 0n;
	for (const byte of ordered) {
		value = (value << 8n) | BigInt(byte);
	}
	return value.toString(16).toUpperCase().padStart(bytes.length * 2, '0');
}

export function parseEditableMemoryValue(text: string, byteLength: number, endianness: Endianness): number[] {
	const source = text.trim().replace(/^0x/i, '');
	if (!/^[0-9a-f]+$/i.test(source)) {
		throw new Error('Enter hexadecimal digits, for example 49 or 0x49');
	}
	let value = BigInt(`0x${source}`);
	if (value >= (1n << BigInt(byteLength * 8))) {
		throw new Error(`Value exceeds ${byteLength} bytes`);
	}
	const bytes: number[] = [];
	for (let index = 0; index < byteLength; index++) {
		bytes.push(Number(value & 0xffn));
		value >>= 8n;
	}
	return endianness === 'little' ? bytes : bytes.reverse();
}
