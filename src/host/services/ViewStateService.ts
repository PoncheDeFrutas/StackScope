import * as vscode from 'vscode';
import type { ViewStateSnapshot } from '../../protocol/methods.js';
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
	constructor(private readonly context: vscode.ExtensionContext) {}

	get(): ViewStateSnapshot | null {
		const stored = this.context.workspaceState.get<unknown>(STORAGE_KEY);
		return sanitizeViewState(stored);
	}

	save(viewState: ViewStateSnapshot): Thenable<void> {
		return this.context.workspaceState.update(STORAGE_KEY, sanitizeViewState(viewState));
	}
}

export function sanitizeViewState(value: unknown): ViewStateSnapshot | null {
	if (!isRecord(value)) {
		return null;
	}

	return {
		currentTarget: typeof value.currentTarget === 'string' ? value.currentTarget.trim() : '',
		config: sanitizeMemoryViewConfig(value.config),
		showSettings: typeof value.showSettings === 'boolean' ? value.showSettings : false,
		showRegisterPanel: typeof value.showRegisterPanel === 'boolean' ? value.showRegisterPanel : true,
		registerPanelWidth: sanitizeRegisterPanelWidth(value.registerPanelWidth),
		registerValueFormat: sanitizeRegisterValueFormat(value.registerValueFormat),
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

function sanitizeRegisterValueFormat(value: unknown): ViewStateSnapshot['registerValueFormat'] {
	return VALID_REGISTER_VALUE_FORMATS.includes(value as ViewStateSnapshot['registerValueFormat'])
		? value as ViewStateSnapshot['registerValueFormat']
		: 'hex';
}

function isEndianness(value: unknown): value is Endianness {
	return value === 'little' || value === 'big';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
