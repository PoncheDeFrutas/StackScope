import * as assert from 'assert';
import { DataWatchpointService } from '../host/services/DataWatchpointService.js';
import { DebugMutationService } from '../host/services/DebugMutationService.js';

suite('DataWatchpointService', () => {
	test('falls back to GDB for a register rejected by DAP and removes it independently', async () => {
		const commands: string[] = [];
		const service = new DataWatchpointService(
			{ getState: () => ({ sessionId: 'session-1', status: 'stopped' }), refresh: async () => ({ sessionId: 'session-1', status: 'stopped' }), onStateChanged: () => () => {}, dispose: () => {} },
			{
				getDataBreakpointInfo: async () => ({ dataId: null, description: 'Register is not exposed by DAP', accessTypes: [] }),
				setDataBreakpoints: async () => [],
				createGdbWatchpoint: async (_sessionId: string, expression: string, accessType: 'read' | 'write' | 'readWrite') => { commands.push(`create:${expression}:${accessType}`); return { breakpointId: 12, verified: true }; },
				removeGdbWatchpoint: async (_sessionId: string, breakpointId: number) => { commands.push(`remove:${breakpointId}`); return { breakpointId, verified: true }; },
			} as never,
			{ getDataBreakpointSupport: () => ({ dataBreakpoints: true, memoryRanges: false, gdbRegisterFallback: true }), onDidObserveDataBreakpoints: () => ({ dispose: () => {} }) } as never,
			new DebugMutationService(),
			() => undefined,
		);

		const candidate = await service.getCandidate({ kind: 'register', expression: '$rax', label: 'RAX' });
		assert.strictEqual(candidate.backend, 'gdb');
		assert.ok(candidate.candidateId);
		const watchpoint = await service.create(candidate.candidateId!, 'readWrite');
		assert.deepStrictEqual({ backend: watchpoint.backend, breakpointId: watchpoint.breakpointId, verified: watchpoint.verified }, { backend: 'gdb', breakpointId: 12, verified: true });
		assert.strictEqual(await service.remove(watchpoint.id), true);
		assert.deepStrictEqual(commands, ['create:$rax:readWrite', 'remove:12']);
		service.dispose();
	});
});
