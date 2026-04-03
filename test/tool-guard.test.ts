/// <reference types="vitest/globals" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Tool guard widget tests
 *
 * Verify that checkRequiredTools (called on session_start) shows/hides
 * a persistent warning widget based on required tool availability.
 *
 * Three states:
 *   1. All required tools active       → widget cleared
 *   2. Tool registered but not active  → "Disabled" banner
 *   3. Tool not registered at all      → "Not installed" banner
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

const mockTheme = {
	fg: (_color: string, text: string) => text,
};

type SessionStartHandler = (event: unknown, ctx: unknown) => Promise<void>;
type WidgetFactory = ((tui: unknown, theme: unknown) => unknown) | undefined;

function loadExtensionWithToolGuard(opts: {
	allTools: Array<{ name: string }>;
	activeTools: string[];
}) {
	let lastWidgetFactory: WidgetFactory = undefined;
	let widgetSetCount = 0;
	const handlers = new Map<string, SessionStartHandler>();

	const mockPi = {
		registerCommand() {},
		sendUserMessage() {},
		on(event: string, handler: SessionStartHandler) {
			handlers.set(event, handler);
		},
		getAllTools: () =>
			opts.allTools.map((t) => ({
				name: t.name,
				description: '',
				parameters: {},
				sourceInfo: { source: 'test', path: '' },
			})),
		getActiveTools: () => opts.activeTools,
	};

	const mockCtx = {
		ui: {
			notify() {},
			setWidget(_key: string, factory: WidgetFactory) {
				lastWidgetFactory = factory;
				widgetSetCount++;
			},
			theme: mockTheme,
		},
	};

	return {
		mockPi,
		mockCtx,
		handlers,
		getWidgetFactory: () => lastWidgetFactory,
		getWidgetSetCount: () => widgetSetCount,
	};
}

/** Render a widget factory and extract the joined text from Text children. */
function renderWidgetText(factory: WidgetFactory): string {
	if (!factory) return '';
	const component = factory(null, mockTheme) as {
		children?: Array<{ text?: string }>;
	};
	if (!component.children) return '';
	return component.children
		.filter((c): c is { text: string } => typeof c?.text === 'string')
		.map((c) => c.text)
		.join(' ');
}

// ---------------------------------------------------------------------------
// Setup — bare temp directory
// ---------------------------------------------------------------------------

let cwd: string;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), 'tool-guard-'));
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

async function initExtension(mockPi: unknown) {
	const originalCwd = process.cwd();
	process.chdir(cwd);
	try {
		const mod = await import('../extensions/index');
		mod.default(mockPi as ExtensionAPI);
	} finally {
		process.chdir(originalCwd);
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tool guard widget', () => {
	test('clears widget when all required tools are active', async () => {
		const { mockPi, mockCtx, handlers, getWidgetFactory } = loadExtensionWithToolGuard({
			allTools: [{ name: 'ask_user' }, { name: 'read' }],
			activeTools: ['ask_user', 'read'],
		});

		await initExtension(mockPi);
		await handlers.get('session_start')!(undefined, mockCtx);

		// Widget should be cleared (factory = undefined)
		expect(getWidgetFactory()).toBeUndefined();
	});

	test('shows "Not installed" banner when tool is not registered', async () => {
		const { mockPi, mockCtx, handlers, getWidgetFactory } = loadExtensionWithToolGuard({
			allTools: [{ name: 'read' }],
			activeTools: ['read'],
		});

		await initExtension(mockPi);
		await handlers.get('session_start')!(undefined, mockCtx);

		const factory = getWidgetFactory();
		expect(factory).toBeDefined();

		const text = renderWidgetText(factory);
		expect(text).toContain('Not installed:');
		expect(text).toContain('ask_user');
		expect(text).toContain('pi install npm:pi-ask-user');
	});

	test('shows "Disabled" banner when tool is registered but not active', async () => {
		const { mockPi, mockCtx, handlers, getWidgetFactory } = loadExtensionWithToolGuard({
			allTools: [{ name: 'ask_user' }, { name: 'read' }],
			activeTools: ['read'],
		});

		await initExtension(mockPi);
		await handlers.get('session_start')!(undefined, mockCtx);

		const factory = getWidgetFactory();
		expect(factory).toBeDefined();

		const text = renderWidgetText(factory);
		expect(text).toContain('Disabled:');
		expect(text).toContain('ask_user');
		expect(text).toContain('enable in tool configuration');
		// Must NOT suggest pi install — it's already installed
		expect(text).not.toContain('pi install');
	});

	test('does not call getAllTools when all required tools are active', async () => {
		let getAllToolsCalled = false;

		const { mockPi, mockCtx, handlers } = loadExtensionWithToolGuard({
			allTools: [{ name: 'ask_user' }],
			activeTools: ['ask_user'],
		});

		const originalGetAllTools = mockPi.getAllTools;
		mockPi.getAllTools = () => {
			getAllToolsCalled = true;
			return originalGetAllTools();
		};

		await initExtension(mockPi);
		await handlers.get('session_start')!(undefined, mockCtx);

		expect(getAllToolsCalled).toBe(false);
	});
});
