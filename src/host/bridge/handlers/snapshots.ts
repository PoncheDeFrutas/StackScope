import type { MemoryPreset } from '../../../domain/presets/MemoryPreset.js';
import { isBuiltinPreset } from '../../../domain/presets/MemoryPreset.js';
import type { RegisterSet } from '../../../domain/registers/RegisterSet.js';
import { isBuiltinRegisterSet } from '../../../domain/registers/RegisterSet.js';

export function toPresetSnapshot(preset: MemoryPreset) {
	return {
		id: preset.id,
		name: preset.name,
		target: preset.target,
		description: preset.description,
		isBuiltin: isBuiltinPreset(preset),
	};
}

export function toRegisterSetSnapshot(registerSet: RegisterSet) {
	return {
		id: registerSet.id,
		name: registerSet.name,
		registers: registerSet.registers.map((register) => ({
			expression: register.expression,
			label: register.label,
		})),
		description: registerSet.description,
		isBuiltin: isBuiltinRegisterSet(registerSet),
	};
}
