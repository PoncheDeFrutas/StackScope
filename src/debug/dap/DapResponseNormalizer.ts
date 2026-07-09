import type { ReadMemoryResult } from '../contracts/DebugGateway.js';

export interface DapReadMemoryResponse {
	address?: string;
	data?: string;
}

export function normalizeReadMemoryResponse(
	memoryReference: string,
	offset: number,
	count: number,
	response: DapReadMemoryResponse | null | undefined
): ReadMemoryResult {
	if (!response?.data) {
		return createUnreadableMemoryResult(memoryReference, offset, count);
	}

	const bytes = Array.from(Buffer.from(response.data, 'base64'));
	const data: (number | null)[] = [...bytes];
	while (data.length < count) {
		data.push(null);
	}

	return {
		address: response.address ?? memoryReference,
		data,
		bytesRead: bytes.length,
		hasUnreadable: bytes.length < count,
	};
}

export function createUnreadableMemoryResult(
	memoryReference: string,
	offset: number,
	count: number
): ReadMemoryResult {
	let address = memoryReference;
	try {
		address = '0x' + (BigInt(memoryReference) + BigInt(offset)).toString(16);
	} catch {
		// Keep original reference when adapter returned a non-numeric reference.
	}

	return {
		address,
		data: new Array(count).fill(null),
		bytesRead: 0,
		hasUnreadable: true,
	};
}

export function getDapErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
