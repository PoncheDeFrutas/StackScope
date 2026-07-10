import type { DebugGateway } from '../../../debug/contracts/DebugGateway.js';
import type { SessionTracker } from '../../../debug/contracts/SessionTracker.js';
import { ProtocolErrorCode, createProtocolError } from '../../../protocol/errors.js';
import type { RegisterSetService } from '../../services/RegisterSetService.js';
import type { ViewStateService } from '../../services/ViewStateService.js';
import { setHandler, type HandlerRegistry } from './types.js';

export interface RegisterStateHandlerDependencies {
	sessionTracker: SessionTracker;
	debugGateway: DebugGateway;
	registerSetService: RegisterSetService;
	viewStateService: ViewStateService;
	getSelectedFrameId: (sessionId: string) => number | undefined;
}

export function registerRegisterStateHandlers(
	handlers: HandlerRegistry,
	dependencies: RegisterStateHandlerDependencies
): void {
	const {
		sessionTracker,
		debugGateway,
		registerSetService,
		viewStateService,
		getSelectedFrameId,
	} = dependencies;

	setHandler(handlers, 'readRegisters', async ({ setId }) => {
		const state = await sessionTracker.refresh();
		if (!state.sessionId) {
			throw createProtocolError(ProtocolErrorCode.NO_ACTIVE_SESSION, 'No active debug session');
		}
		if (state.status !== 'stopped') {
			throw createProtocolError(
				ProtocolErrorCode.SESSION_NOT_STOPPED,
				'Debug session is not stopped. Pause execution to read registers.'
			);
		}

		const registerSet = registerSetService.get(setId);
		if (!registerSet) {
			throw createProtocolError(
				ProtocolErrorCode.UNKNOWN_ERROR,
				`Register set ${setId} not found`
			);
		}

		const results = await debugGateway.readRegisters(
			state.sessionId,
			registerSet.registers.map((register) => register.expression),
			getSelectedFrameId(state.sessionId)
		);
		return {
			values: registerSet.registers.map((register, index) => {
				const result = results[index] ?? { expression: register.expression, value: null };
				return {
					expression: register.expression,
					label: register.label ?? register.expression,
					value: result.value,
					error: result.error,
				};
			}),
		};
	});

	setHandler(handlers, 'saveViewState', async ({ viewState }) => {
		await viewStateService.save(viewState);
		return { success: true };
	});
	setHandler(handlers, 'saveRegisterViewState', async ({ registerValueFormat }) => {
		await viewStateService.saveRegisterViewState(registerValueFormat);
		return { success: true };
	});
}
