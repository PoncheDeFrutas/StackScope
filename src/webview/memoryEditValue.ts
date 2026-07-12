import type { Endianness, NumberFormat } from '../domain/config/MemoryViewConfig.js';

export type MemoryInputFormat = NumberFormat | 'ascii';

export const MEMORY_INPUT_FORMATS: readonly MemoryInputFormat[] = ['hex', 'dec', 'oct', 'bin', 'ascii'];

export function formatEditableMemoryValue(
	bytes: readonly number[],
	endianness: Endianness,
	format: MemoryInputFormat = 'hex'
): string {
	if (format === 'ascii') {
		return bytes.every((byte) => byte >= 0x20 && byte <= 0x7e)
			? String.fromCharCode(...bytes)
			: '';
	}
	const ordered = endianness === 'little' ? [...bytes].reverse() : bytes;
	let value = 0n;
	for (const byte of ordered) {
		value = (value << 8n) | BigInt(byte);
	}
	if (format === 'hex') {
		return value.toString(16).toUpperCase().padStart(bytes.length * 2, '0');
	}
	return value.toString(format === 'dec' ? 10 : format === 'oct' ? 8 : 2);
}

export function parseEditableMemoryValue(
	text: string,
	byteLength: number,
	endianness: Endianness,
	format: MemoryInputFormat = 'hex'
): number[] {
	if (format === 'ascii') {
		return parseAscii(text, byteLength);
	}
	const source = normalizeNumericInput(text, format);
	const value = parseNumericValue(source, format);
	if (value >= (1n << BigInt(byteLength * 8))) {
		throw new Error(`Value exceeds ${byteLength} bytes`);
	}
	const bytes: number[] = [];
	let remaining = value;
	for (let index = 0; index < byteLength; index++) {
		bytes.push(Number(remaining & 0xffn));
		remaining >>= 8n;
	}
	return endianness === 'little' ? bytes : bytes.reverse();
}

function normalizeNumericInput(text: string, format: Exclude<MemoryInputFormat, 'ascii'>): string {
	const source = text.trim();
	const prefix = format === 'hex' ? /^0x/i : format === 'oct' ? /^0o/i : format === 'bin' ? /^0b/i : /^/;
	return source.replace(prefix, '');
}

function parseNumericValue(source: string, format: Exclude<MemoryInputFormat, 'ascii'>): bigint {
	const patterns: Record<Exclude<MemoryInputFormat, 'ascii'>, RegExp> = {
		hex: /^[0-9a-f]+$/i,
		dec: /^\d+$/,
		oct: /^[0-7]+$/,
		bin: /^[01]+$/,
	};
	if (!patterns[format].test(source)) {
		throw new Error(`Enter a valid ${formatName(format)} value`);
	}
	const radixPrefix: Record<Exclude<MemoryInputFormat, 'ascii'>, string> = {
		hex: '0x',
		dec: '',
		oct: '0o',
		bin: '0b',
	};
	return BigInt(`${radixPrefix[format]}${source}`);
}

function parseAscii(text: string, byteLength: number): number[] {
	if (text.length === 0) {
		throw new Error('Enter at least one ASCII character');
	}
	if (text.length > byteLength) {
		throw new Error(`ASCII input exceeds ${byteLength} bytes`);
	}
	const bytes = Array.from(text, (character) => character.charCodeAt(0));
	if (bytes.some((byte) => byte > 0x7f)) {
		throw new Error('ASCII input supports only 7-bit characters');
	}
	return bytes;
}

function formatName(format: Exclude<MemoryInputFormat, 'ascii'>): string {
	return format === 'hex' ? 'hexadecimal' : format === 'dec' ? 'decimal' : format === 'oct' ? 'octal' : 'binary';
}
