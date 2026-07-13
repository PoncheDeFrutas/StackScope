import type { DataWatchpointService } from '../../services/DataWatchpointService.js';
import { setHandler, type HandlerRegistry } from './types.js';

export function registerWatchpointHandlers(
	handlers: HandlerRegistry,
	dependencies: { dataWatchpoints: DataWatchpointService }
): void {
	setHandler(handlers, 'getWatchpointCandidate', ({ target }) => dependencies.dataWatchpoints.getCandidate(target));
	setHandler(handlers, 'createWatchpoint', async ({ candidateId, accessType }) => ({
		watchpoint: await dependencies.dataWatchpoints.create(candidateId, accessType),
	}));
	setHandler(handlers, 'removeWatchpoint', async ({ id }) => ({
		success: await dependencies.dataWatchpoints.remove(id),
	}));
}
