import type { SessionTracker } from '../../../debug/contracts/SessionTracker.js';
import type { PresetService } from '../../services/PresetService.js';
import type { RegisterSetService } from '../../services/RegisterSetService.js';
import type { ViewStateService } from '../../services/ViewStateService.js';
import type { MemoryDocumentService } from '../../services/MemoryDocumentService.js';
import type { DapCapabilitiesService } from '../../../debug/dap/DapCapabilitiesService.js';
import type { DataWatchpointService } from '../../services/DataWatchpointService.js';
import { toPresetSnapshot, toRegisterSetSnapshot } from './snapshots.js';
import { setHandler, type HandlerRegistry } from './types.js';

export interface WorkspaceHandlerDependencies {
	sessionTracker: SessionTracker;
	documentService: MemoryDocumentService;
	presetService: PresetService;
	registerSetService: RegisterSetService;
	viewStateService: ViewStateService;
	capabilities: DapCapabilitiesService;
	dataWatchpoints: DataWatchpointService;
}

export function registerWorkspaceHandlers(
	handlers: HandlerRegistry,
	dependencies: WorkspaceHandlerDependencies
): void {
	const {
		sessionTracker,
		documentService,
		presetService,
		registerSetService,
		viewStateService,
		capabilities,
		dataWatchpoints,
	} = dependencies;

	setHandler(handlers, 'init', async () => {
		const state = await sessionTracker.refresh();
		const { activeDocument, documents } = documentService.listDocuments();
		return {
			session: { sessionId: state.sessionId, status: state.status },
			activeDocument,
			documents,
			presets: presetService.getAll().map(toPresetSnapshot),
			registerSets: registerSetService.getAll().map(toRegisterSetSnapshot),
			selectedRegisterSetId: registerSetService.getSelectedId(),
			viewState: viewStateService.get(),
			memoryWriteSupported: state.sessionId ? capabilities.getWriteSupport(state.sessionId).memory : false,
			registerWriteSupported: state.sessionId ? capabilities.getWriteSupport(state.sessionId).register : false,
			watchpointSupport: state.sessionId ? capabilities.getDataBreakpointSupport(state.sessionId) : { dataBreakpoints: false, memoryRanges: false, gdbRegisterFallback: false },
			watchpoints: dataWatchpoints.list(state.sessionId),
		};
	});

	setHandler(handlers, 'listPresets', async () => ({
		presets: presetService.getAll().map(toPresetSnapshot),
	}));
	setHandler(handlers, 'savePreset', async ({ name, target, description }) => ({
		preset: toPresetSnapshot(presetService.save(name, target, description)),
	}));
	setHandler(handlers, 'deletePreset', async ({ id }) => ({
		success: presetService.delete(id),
	}));

	setHandler(handlers, 'listRegisterSets', async () => ({
		registerSets: registerSetService.getAll().map(toRegisterSetSnapshot),
		selectedId: registerSetService.getSelectedId(),
	}));
	setHandler(handlers, 'saveRegisterSet', async ({ name, registers, description }) => ({
		registerSet: toRegisterSetSnapshot(registerSetService.save(name, registers, description)),
	}));
	setHandler(handlers, 'updateRegisterSet', async ({ id, name, registers, description }) => {
		const registerSet = registerSetService.update(id, { name, registers, description });
		return { registerSet: registerSet ? toRegisterSetSnapshot(registerSet) : null };
	});
	setHandler(handlers, 'deleteRegisterSet', async ({ id }) => ({
		success: registerSetService.delete(id),
	}));
	setHandler(handlers, 'selectRegisterSet', async ({ id }) => ({
		success: registerSetService.select(id),
	}));
}
