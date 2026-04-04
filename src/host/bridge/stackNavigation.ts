import type {
	DisassembledInstructionResult,
} from '../../debug/contracts/DebugGateway.js';
import type {
	DisassembledInstructionSnapshot,
	StackFrameSnapshot,
	StackThreadSnapshot,
} from '../../protocol/methods.js';

export interface StackFrameLookupRequest {
	threadId: number;
	frameId: number;
	frameIndex?: number;
	frameName?: string;
	sourcePath?: string;
	line?: number;
	column?: number;
}

export function resolveRequestedFrame(
	threads: StackThreadSnapshot[],
	request: StackFrameLookupRequest
): StackFrameSnapshot | null {
	const thread = threads.find((item) => item.id === request.threadId);
	if (!thread) {
		return null;
	}

	if (
		typeof request.frameIndex === 'number' &&
		request.frameIndex >= 0 &&
		request.frameIndex < thread.frames.length
	) {
		return thread.frames[request.frameIndex] ?? null;
	}

	const exactIdMatch = thread.frames.find((frame) => frame.id === request.frameId);
	if (exactIdMatch) {
		return exactIdMatch;
	}

	const exactSourceMatch = thread.frames.find(
		(frame) =>
			request.sourcePath &&
			frame.sourcePath === request.sourcePath &&
			frame.line === request.line &&
			(request.column === undefined || frame.column === request.column)
	);
	if (exactSourceMatch) {
		return exactSourceMatch;
	}

	const exactNameMatch = thread.frames.find(
		(frame) =>
			request.frameName &&
			frame.name === request.frameName &&
			(request.line === undefined || frame.line === request.line)
	);
	if (exactNameMatch) {
		return exactNameMatch;
	}

	return null;
}

export function toInstructionSnapshots(
	instructions: DisassembledInstructionResult[],
	currentAddress: string
): DisassembledInstructionSnapshot[] {
	const normalizedCurrent = normalizeAddress(currentAddress);
	let matchedCurrent = false;

	const snapshots = instructions.map((instruction) => {
		const isCurrent =
			normalizedCurrent !== null &&
			normalizedCurrent === normalizeAddress(instruction.address);
		if (isCurrent) {
			matchedCurrent = true;
		}

		return {
			address: instruction.address,
			instruction: instruction.instruction,
			instructionBytes: instruction.instructionBytes,
			symbol: instruction.symbol,
			sourceName: instruction.sourceName,
			sourcePath: instruction.sourcePath,
			line: instruction.line,
			column: instruction.column,
			isCurrent,
		};
	});

	if (matchedCurrent || snapshots.length === 0) {
		return snapshots;
	}

	const fallbackIndex = Math.min(Math.floor(snapshots.length / 2), snapshots.length - 1);
	return snapshots.map((instruction, index) => ({
		...instruction,
		isCurrent: index === fallbackIndex,
	}));
}

function normalizeAddress(value: string | undefined): string | null {
	if (!value) {
		return null;
	}

	try {
		return BigInt(value).toString(16);
	} catch {
		const match = value.match(/0x[0-9a-f]+/i);
		if (!match) {
			return null;
		}
		try {
			return BigInt(match[0]).toString(16);
		} catch {
			return null;
		}
	}
}
