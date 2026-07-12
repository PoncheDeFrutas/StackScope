import type { DebugGateway } from '../../../debug/contracts/DebugGateway.js';
import type { SessionTracker } from '../../../debug/contracts/SessionTracker.js';
import { ProtocolErrorCode, createProtocolError } from '../../../protocol/errors.js';
import type { RegisterSetService } from '../../services/RegisterSetService.js';
import type { ViewStateService } from '../../services/ViewStateService.js';
import type { DebugMutationService } from '../../services/DebugMutationService.js';
import { setHandler, type HandlerRegistry } from './types.js';

export interface RegisterStateHandlerDependencies {
	sessionTracker: SessionTracker;
	debugGateway: DebugGateway;
	registerSetService: RegisterSetService;
	viewStateService: ViewStateService;
	debugMutations: DebugMutationService;
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
		debugMutations,
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

	setHandler(handlers, 'writeRegister', async ({ expression, value }) => {
		if (!expression.trim() || !value.trim()) {
			throw createProtocolError(ProtocolErrorCode.WRITE_REGISTER_FAILED, 'Register expression and value are required');
		}
		const state = await sessionTracker.refresh();
		if (!state.sessionId) {
			throw createProtocolError(ProtocolErrorCode.NO_ACTIVE_SESSION, 'No active debug session');
		}
		if (state.status !== 'stopped') {
			throw createProtocolError(ProtocolErrorCode.SESSION_NOT_STOPPED, 'Pause execution before writing registers.');
		}
		return debugMutations.run(state.sessionId, async () => {
			const current = await sessionTracker.refresh();
			if (!current.sessionId || current.sessionId !== state.sessionId) {
				throw createProtocolError(ProtocolErrorCode.NO_ACTIVE_SESSION, 'Debug session changed before register write');
			}
			if (current.status !== 'stopped') {
				throw createProtocolError(ProtocolErrorCode.SESSION_NOT_STOPPED, 'Pause execution before writing registers.');
			}
			const written = await debugGateway.setExpression(current.sessionId, expression.trim(), value.trim(), getSelectedFrameId(current.sessionId));
			if (!written) {
				throw createProtocolError(ProtocolErrorCode.WRITE_REGISTER_UNSUPPORTED, 'Debugger does not support writable register expressions');
			}
			const verification = await debugGateway.readRegisters(current.sessionId, [expression.trim()], getSelectedFrameId(current.sessionId));
			const actual = verification[0]?.value ?? null;
			return { value: written.value, readBackValue: actual, readBackAvailable: actual !== null };
		});
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
