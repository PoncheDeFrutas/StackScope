import * as vscode from 'vscode';
import type {
	MemoryViewState,
	RegisterViewState,
	ViewStateSnapshot,
} from '../../protocol/methods.js';
import { SequentialTaskQueue } from '../../shared/SequentialTaskQueue.js';
import {
	DEFAULT_CONFIG,
	MAX_TOTAL_SIZE,
	MIN_TOTAL_SIZE,
	VALID_COLUMNS,
	VALID_DECODED_MODES,
	VALID_NUMBER_FORMATS,
	VALID_UNIT_SIZES,
	type DecodedMode,
	type Endianness,
	type MemoryViewConfig,
	type NumberFormat,
	type UnitSize,
} from '../../domain/config/MemoryViewConfig.js';

const STORAGE_KEY = 'stackscope.viewState';
const DEFAULT_REGISTER_PANEL_WIDTH = 320;
const MIN_REGISTER_PANEL_WIDTH = 180;
const MAX_REGISTER_PANEL_WIDTH = 640;
const VALID_REGISTER_VALUE_FORMATS = ['hex', 'dec', 'oct', 'bin', 'raw'] as const;

/**
 * Service for persisting webview UI state in workspace storage.
 */
export class ViewStateService {
	private readonly writeQueue = new SequentialTaskQueue();

	constructor(private readonly context: vscode.ExtensionContext) {}

	get(): ViewStateSnapshot | null {
		const stored = this.context.workspaceState.get<unknown>(STORAGE_KEY);
		return sanitizeViewState(stored);
	}

	save(viewState: MemoryViewState): Thenable<void> {
		return this.enqueueUpdate((current) => mergeMemoryViewState(current, viewState));
	}

	saveRegisterViewState(
		viewState: RegisterViewState['registerValueFormat'] | (Partial<RegisterViewState> & Pick<RegisterViewState, 'registerValueFormat'>)
	): Thenable<void> {
		const next = typeof viewState === 'string' ? { registerValueFormat: viewState } : viewState;
		return this.enqueueUpdate((current) =>
			mergeRegisterViewState(current, next)
		);
	}

	private enqueueUpdate(
		merge: (current: ViewStateSnapshot | null) => ViewStateSnapshot
	): Thenable<void> {
		return this.writeQueue.enqueue(() =>
			this.context.workspaceState.update(STORAGE_KEY, merge(this.get()))
		);
	}
}

export function mergeMemoryViewState(
	current: ViewStateSnapshot | null,
	viewState: MemoryViewState
): ViewStateSnapshot {
	const next = sanitizeMemoryViewState(viewState) ?? createDefaultViewState();
	const base = current ?? createDefaultViewState();
	return {
		...base,
		...next,
	};
}

export function mergeRegisterValueFormat(
	current: ViewStateSnapshot | null,
	registerValueFormat: unknown
): ViewStateSnapshot {
	const base = current ?? createDefaultViewState();
	return {
		...base,
		registerValueFormat: sanitizeRegisterValueFormat(registerValueFormat),
	};
}

export function mergeRegisterViewState(
	current: ViewStateSnapshot | null,
	viewState: Partial<RegisterViewState> & Pick<RegisterViewState, 'registerValueFormat'>
): ViewStateSnapshot {
	const base = mergeRegisterValueFormat(current, viewState.registerValueFormat);
	return {
		...base,
		registersExpanded: typeof viewState.registersExpanded === 'boolean' ? viewState.registersExpanded : base.registersExpanded,
		watchpointsExpanded: typeof viewState.watchpointsExpanded === 'boolean' ? viewState.watchpointsExpanded : base.watchpointsExpanded,
	};
}

export function sanitizeViewState(value: unknown): ViewStateSnapshot | null {
	const memoryViewState = sanitizeMemoryViewState(value);
	if (!memoryViewState || !isRecord(value)) {
		return null;
	}

	return {
		...memoryViewState,
		showRegisterPanel: typeof value.showRegisterPanel === 'boolean' ? value.showRegisterPanel : true,
		registerPanelWidth: sanitizeRegisterPanelWidth(value.registerPanelWidth),
		registerValueFormat: sanitizeRegisterValueFormat(value.registerValueFormat),
		registersExpanded: typeof value.registersExpanded === 'boolean' ? value.registersExpanded : true,
		watchpointsExpanded: typeof value.watchpointsExpanded === 'boolean' ? value.watchpointsExpanded : false,
	};
}

export function sanitizeMemoryViewState(value: unknown): MemoryViewState | null {
	if (!isRecord(value)) {
		return null;
	}
	return {
		currentTarget: typeof value.currentTarget === 'string' ? value.currentTarget.trim() : '',
		config: sanitizeMemoryViewConfig(value.config),
		showSettings: typeof value.showSettings === 'boolean' ? value.showSettings : false,
	};
}

function createDefaultViewState(): ViewStateSnapshot {
	return {
		currentTarget: '',
		config: DEFAULT_CONFIG,
		showSettings: false,
		showRegisterPanel: true,
		registerPanelWidth: DEFAULT_REGISTER_PANEL_WIDTH,
		registerValueFormat: 'hex',
		registersExpanded: true,
		watchpointsExpanded: false,
	};
}

function sanitizeMemoryViewConfig(value: unknown): MemoryViewConfig {
	if (!isRecord(value)) {
		return DEFAULT_CONFIG;
	}

	const columns = VALID_COLUMNS.includes(value.columns as typeof VALID_COLUMNS[number])
		? value.columns as MemoryViewConfig['columns']
		: DEFAULT_CONFIG.columns;
	const unitSize = VALID_UNIT_SIZES.includes(value.unitSize as UnitSize)
		? value.unitSize as UnitSize
		: DEFAULT_CONFIG.unitSize;
	const endianness = isEndianness(value.endianness) ? value.endianness : DEFAULT_CONFIG.endianness;
	const totalSize = sanitizeTotalSize(value.totalSize);
	const numberFormat = VALID_NUMBER_FORMATS.includes(value.numberFormat as NumberFormat)
		? value.numberFormat as NumberFormat
		: DEFAULT_CONFIG.numberFormat;
	const decodedMode = VALID_DECODED_MODES.includes(value.decodedMode as DecodedMode)
		? value.decodedMode as DecodedMode
		: DEFAULT_CONFIG.decodedMode;

	return Object.freeze({
		columns,
		unitSize,
		endianness,
		totalSize,
		numberFormat,
		decodedMode,
	});
}

function sanitizeTotalSize(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return DEFAULT_CONFIG.totalSize;
	}
	return Math.min(Math.max(Math.floor(value), MIN_TOTAL_SIZE), MAX_TOTAL_SIZE);
}

function sanitizeRegisterPanelWidth(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return DEFAULT_REGISTER_PANEL_WIDTH;
	}
	return Math.min(Math.max(Math.floor(value), MIN_REGISTER_PANEL_WIDTH), MAX_REGISTER_PANEL_WIDTH);
}

function sanitizeRegisterValueFormat(value: unknown): RegisterViewState['registerValueFormat'] {
	return VALID_REGISTER_VALUE_FORMATS.includes(value as RegisterViewState['registerValueFormat'])
		? value as RegisterViewState['registerValueFormat']
		: 'hex';
}

function isEndianness(value: unknown): value is Endianness {
	return value === 'little' || value === 'big';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
