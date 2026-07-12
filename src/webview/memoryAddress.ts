/** Parses hexadecimal, decimal, or bare hexadecimal memory addresses. */
export function parseMemoryAddress(address: string): bigint {
	try {
		const cleaned = address.trim().toLowerCase();
		if (cleaned.startsWith('0x') || /^\d+$/.test(cleaned)) {
			return BigInt(cleaned);
		}
		return BigInt(`0x${cleaned}`);
	} catch {
		return 0n;
	}
}

/** Formats addresses consistently across memory views and clipboard dumps. */
export function formatMemoryAddress(address: bigint): string {
	return '0x' + address.toString(16).padStart(16, '0').toUpperCase();
}
