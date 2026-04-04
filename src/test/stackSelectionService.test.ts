import * as assert from 'assert';
import { StackSelectionService } from '../host/services/StackSelectionService.js';

suite('StackSelectionService', () => {
	test('stores and returns current selection', () => {
		const service = new StackSelectionService();

		service.set('session-1', 7, 42);

		assert.deepStrictEqual(service.get(), {
			sessionId: 'session-1',
			threadId: 7,
			frameId: 42,
		});
	});

	test('clears selection when session changes', () => {
		const service = new StackSelectionService();

		service.set('session-1', 7, 42);
		service.clearIfSessionChanged('session-2');

		assert.deepStrictEqual(service.get(), {
			sessionId: null,
			threadId: null,
			frameId: null,
		});
	});
});
