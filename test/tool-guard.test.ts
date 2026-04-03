/// <reference types="vitest/globals" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Tool guard widget tests
 *
 * Verify that checkRequiredTools shows/hides a persistent warning widget
 * based on required tool availability.
 *
 * Three states:
 *   1. All required tools active       → widget cleared
 *   2. Tool registered but not active  → "Disabled" banner
 *   3. Tool not registered at all      → "Not installed" banner
 */

import {
	createMockPi,
	createSessionContext,
	loadExtension,
	renderWidgetText,
} from './helpers/mock-pi';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let cwd: string;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), 'tool-guard-'));
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tool guard widget', () => {
	test('clears widget when all required tools are active', async () => {
		const { mockPi, eventHandlers } = createMockPi({
			allTools: [{ name: 'ask_user' }, { name: 'read' }],
			activeTools: ['ask_user', 'read'],
		});

		await loadExtension(mockPi, cwd);
		const { ctx, getWidgetFactory } = createSessionContext();
		await eventHandlers.get('session_start')!(undefined, ctx);

		expect(getWidgetFactory()).toBeUndefined();
	});

	test('shows "Not installed" banner when tool is not registered', async () => {
		const { mockPi, eventHandlers } = createMockPi({
			allTools: [{ name: 'read' }],
			activeTools: ['read'],
		});

		await loadExtension(mockPi, cwd);
		const { ctx, getWidgetFactory } = createSessionContext();
		await eventHandlers.get('session_start')!(undefined, ctx);

		const factory = getWidgetFactory();
		expect(factory).toBeDefined();

		const text = renderWidgetText(factory);
		expect(text).toContain('Not installed:');
		expect(text).toContain('ask_user');
		expect(text).toContain('pi install npm:pi-ask-user');
	});

	test('shows "Disabled" banner when tool is registered but not active', async () => {
		const { mockPi, eventHandlers } = createMockPi({
			allTools: [{ name: 'ask_user' }, { name: 'read' }],
			activeTools: ['read'],
		});

		await loadExtension(mockPi, cwd);
		const { ctx, getWidgetFactory } = createSessionContext();
		await eventHandlers.get('session_start')!(undefined, ctx);

		const factory = getWidgetFactory();
		expect(factory).toBeDefined();

		const text = renderWidgetText(factory);
		expect(text).toContain('Disabled:');
		expect(text).toContain('ask_user');
		expect(text).toContain('enable in tool configuration');
		expect(text).not.toContain('pi install');
	});

	test('does not call getAllTools when all required tools are active', async () => {
		let getAllToolsCalled = false;
		const { mockPi, eventHandlers } = createMockPi({
			allTools: [{ name: 'ask_user' }],
			activeTools: ['ask_user'],
		});

		// Wrap getAllTools to track calls
		const original = mockPi.getAllTools;
		(mockPi as any).getAllTools = () => {
			getAllToolsCalled = true;
			return original.call(mockPi);
		};

		await loadExtension(mockPi, cwd);
		const { ctx } = createSessionContext();
		await eventHandlers.get('session_start')!(undefined, ctx);

		expect(getAllToolsCalled).toBe(false);
	});
});
