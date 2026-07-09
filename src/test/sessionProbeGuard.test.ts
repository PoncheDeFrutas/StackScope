import * as assert from 'assert';
import { SessionProbeGuard } from '../debug/vscode/SessionProbeGuard.js';

suite('SessionProbeGuard', () => {
	test('accepts latest probe for active session', () => {
		const guard = new SessionProbeGuard();
		const probe = guard.begin('session-1');

		assert.strictEqual(guard.accepts(probe, 'session-1'), true);
	});

	test('rejects probe invalidated by a session event', () => {
		const guard = new SessionProbeGuard();
		const probe = guard.begin('session-1');
		guard.invalidate();

		assert.strictEqual(guard.accepts(probe, 'session-1'), false);
	});

	test('rejects older probe when newer session probe begins', () => {
		const guard = new SessionProbeGuard();
		const first = guard.begin('session-1');
		const second = guard.begin('session-2');

		assert.strictEqual(guard.accepts(first, 'session-1'), false);
		assert.strictEqual(guard.accepts(second, 'session-2'), true);
	});
});
