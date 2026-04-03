import * as assert from 'assert';
import { DEFAULT_CONFIG } from '../domain/config/MemoryViewConfig.js';
import { sanitizeViewState } from '../host/services/ViewStateService.js';

suite('ViewStateService', () => {
	test('sanitizeViewState returns null for non-object values', () => {
		assert.strictEqual(sanitizeViewState(null), null);
		assert.strictEqual(sanitizeViewState('invalid'), null);
	});

	test('sanitizeViewState preserves valid persisted fields', () => {
		const result = sanitizeViewState({
			currentTarget: '  $sp  ',
			config: {
				columns: 8,
				unitSize: 2,
				endianness: 'big',
				totalSize: 2048,
				numberFormat: 'dec',
				decodedMode: 'hidden',
			},
			showSettings: true,
			showRegisterPanel: false,
			registerPanelWidth: 420,
			registerValueFormat: 'bin',
		});

		assert.deepStrictEqual(result, {
			currentTarget: '$sp',
			config: {
				columns: 8,
				unitSize: 2,
				endianness: 'big',
				totalSize: 2048,
				numberFormat: 'dec',
				decodedMode: 'hidden',
			},
			showSettings: true,
			showRegisterPanel: false,
			registerPanelWidth: 420,
			registerValueFormat: 'bin',
		});
	});

	test('sanitizeViewState falls back to defaults for invalid fields', () => {
		const result = sanitizeViewState({
			currentTarget: 123,
			config: {
				columns: 3,
				unitSize: 3,
				endianness: 'sideways',
				totalSize: 10,
				numberFormat: 'base36',
				decodedMode: 'utf16',
			},
			showSettings: 'yes',
			showRegisterPanel: 'no',
			registerPanelWidth: Number.POSITIVE_INFINITY,
			registerValueFormat: 'signed-decimal',
		});

		assert.deepStrictEqual(result, {
			currentTarget: '',
			config: DEFAULT_CONFIG,
			showSettings: false,
			showRegisterPanel: true,
			registerPanelWidth: 320,
			registerValueFormat: 'hex',
		});
	});
});
