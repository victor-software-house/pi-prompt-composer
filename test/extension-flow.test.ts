/// <reference types="vitest/globals" />
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Layer 3 — Extension-flow tests
 *
 * These tests verify that the extension's command registration and handler
 * behavior work correctly through the full extension entry point. We load
 * the real extension default export with a mock ExtensionAPI that captures
 * registerCommand, sendUserMessage, and ctx.ui interactions.
 *
 * The selector flow now uses ctx.ui.custom() with a GroupSelectorComponent
 * (Pi-native Container + SelectList). Tests mock custom() by instantiating
 * the real component, then programmatically triggering onSelect/onCancel on
 * the SelectList child.
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

// ---------------------------------------------------------------------------
// Types for mock API
// ---------------------------------------------------------------------------
interface RegisteredCommand {
	description: string;
	handler: (argsString: string, ctx: MockCommandContext) => Promise<void>;
	getArgumentCompletions?: (prefix: string) => unknown;
}

interface MockCommandContext {
	ui: {
		select: (title: string, options: string[]) => Promise<string | undefined>;
		input: (title: string, placeholder?: string) => Promise<string | undefined>;
		editor: (title: string, prefill?: string) => Promise<string | undefined>;
		notify: (message: string, severity: string) => void;
		custom: <T>(factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => unknown) => Promise<T>;
	};
}

interface SendUserMessageCall {
	content: string;
	options: Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Helper: load the extension with a controlled cwd
// ---------------------------------------------------------------------------
async function loadExtension(cwd: string) {
	const commands = new Map<string, RegisteredCommand>();
	const sentMessages: SendUserMessageCall[] = [];

	const mockPi = {
		registerCommand(name: string, cmd: RegisteredCommand) {
			commands.set(name, cmd);
		},
		sendUserMessage(content: string, options?: Record<string, unknown>) {
			sentMessages.push({ content, options: options ?? undefined });
		},
	};

	// Temporarily change cwd so the extension's getPromptRoots picks up our fixtures
	const originalCwd = process.cwd();
	process.chdir(cwd);
	try {
		const mod = await import('../extensions/index');
		mod.default(mockPi as unknown as ExtensionAPI);
	} finally {
		process.chdir(originalCwd);
	}

	return { commands, sentMessages };
}

/**
 * Mock theme that returns text unmodified (no ANSI escapes in tests).
 * Matches the Theme.fg(color, text) signature used by GroupSelectorComponent.
 */
const mockTheme = {
	fg: (_color: string, text: string) => text,
};

/**
 * Create a mock custom() that builds the real GroupSelectorComponent
 * with mockTheme, then triggers onSelect on the SelectList child.
 */
function makeSelectorCustomMock(selectValue: string) {
	return async <T>(factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => unknown): Promise<T> => {
		return new Promise<T>((resolve) => {
			const component = factory(null, mockTheme, null, resolve) as { children?: Array<{ onSelect?: (item: { value: string }) => void }> };
			if (component.children) {
				for (const child of component.children) {
					if (typeof child.onSelect === 'function') {
						child.onSelect({ value: selectValue });
						return;
					}
				}
			}
			resolve(undefined as T);
		});
	};
}

/** Create a mock custom() that simulates pressing cancel. */
function makeCancelCustomMock() {
	return async <T>(factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => unknown): Promise<T> => {
		return new Promise<T>((resolve) => {
			const component = factory(null, mockTheme, null, resolve) as { children?: Array<{ onCancel?: () => void }> };
			if (component.children) {
				for (const child of component.children) {
					if (typeof child.onCancel === 'function') {
						child.onCancel();
						return;
					}
				}
			}
			resolve(undefined as T);
		});
	};
}

function createContext(overrides?: {
	input?: MockCommandContext['ui']['input'];
	custom?: MockCommandContext['ui']['custom'];
}) {
	const notifyCalls: Array<{ message: string; severity: string }> = [];
	const inputCalls: Array<{ title: string; placeholder: string | undefined }> = [];

	const ctx: MockCommandContext = {
		ui: {
			select: async () => undefined,
			input: overrides?.input ?? (async () => undefined),
			editor: async (_title, prefill) => prefill,
			notify: (message, severity) => {
				notifyCalls.push({ message, severity });
			},
			custom: overrides?.custom ?? (async () => undefined as never),
		},
	};

	// Wrap input to track calls
	const originalInput = ctx.ui.input;
	ctx.ui.input = async (title, placeholder) => {
		inputCalls.push({ title, placeholder });
		return originalInput(title, placeholder);
	};

	return { ctx, notifyCalls, inputCalls };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
function buildFixture(rootDir: string) {
	const promptsDir = join(rootDir, '.pi', 'prompts', 'testgrp');
	mkdirSync(promptsDir, { recursive: true });

	writeFileSync(join(promptsDir, '_index.md'), '---\ntype: group\ndescription: Test group\n---\n');

	writeFileSync(
		join(promptsDir, 'hello.md'),
		[
			'---',
			'description: Say hello',
			'args:',
			'  - name: target',
			'    required: true',
			'    hint: Who should be greeted?',
			'---',
			'Hello $1 and $ARGUMENTS',
		].join('\n'),
	);

	writeFileSync(join(promptsDir, 'bye.md'), '---\ndescription: Say goodbye\n---\nGoodbye everyone');

	writeFileSync(
		join(promptsDir, 'escaped.md'),
		[
			'---',
			'description: Has escaped dollar signs',
			'args:',
			'  - name: name',
			'    required: true',
			'    hint: Your name',
			'---',
			'Hi $1, use \\$ARGUMENTS to reference all args',
		].join('\n'),
	);
}

let cwd: string;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), 'pi-ext-flow-'));
	buildFixture(cwd);
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// T030 — Direct dispatch
// ---------------------------------------------------------------------------
describe('direct dispatch', () => {
	test('/testgrp hello arg1 arg2 dispatches rendered content with deliverAs followUp', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);

		expect(commands.has('testgrp')).toBe(true);
		const cmd = commands.get('testgrp')!;
		const { ctx, inputCalls } = createContext();

		await cmd.handler('hello arg1 arg2', ctx);

		expect(inputCalls).toHaveLength(0);
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('Hello arg1');
		expect(sentMessages[0]!.content).toContain('arg1 arg2');
		expect(sentMessages[0]!.options).toEqual({ deliverAs: 'followUp' });
	});

	test('/testgrp hello collects missing required args then dispatches rendered content', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('testgrp')!;
		const { ctx, inputCalls } = createContext({
			input: async () => 'world',
		});

		await cmd.handler('hello', ctx);

		expect(inputCalls).toHaveLength(1);
		expect(inputCalls[0]!.title).toContain('/testgrp hello');
		expect(inputCalls[0]!.placeholder).toBe('Who should be greeted?');
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('Hello world and world');
		expect(sentMessages[0]!.options).toEqual({ deliverAs: 'followUp' });
	});
});

// ---------------------------------------------------------------------------
// T031 — Selector flow (rich TUI custom component)
// ---------------------------------------------------------------------------
describe('selector flow', () => {
	test('bare /testgrp opens custom selector and dispatches after collecting args', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('testgrp')!;
		const { ctx, inputCalls } = createContext({
			custom: makeSelectorCustomMock('hello'),
			input: async () => 'Pi user',
		});

		await cmd.handler('', ctx);

		expect(inputCalls).toHaveLength(1);
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('Hello Pi user and Pi user');
		expect(sentMessages[0]!.options).toEqual({ deliverAs: 'followUp' });
	});

	test('bare /testgrp selecting prompt with no args dispatches directly', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('testgrp')!;
		const { ctx, inputCalls } = createContext({
			custom: makeSelectorCustomMock('bye'),
		});

		await cmd.handler('', ctx);

		expect(inputCalls).toHaveLength(0);
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toBe('Goodbye everyone');
	});
});

// ---------------------------------------------------------------------------
// T032 — Selector cancellation
// ---------------------------------------------------------------------------
describe('selector cancellation', () => {
	test('bare /testgrp with cancelled selection dispatches no message', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('testgrp')!;
		const { ctx, inputCalls } = createContext({
			custom: makeCancelCustomMock(),
		});

		await cmd.handler('', ctx);

		expect(inputCalls).toHaveLength(0);
		expect(sentMessages).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// T033 — Unknown subcommand
// ---------------------------------------------------------------------------
describe('unknown subcommand', () => {
	test('/testgrp nonexistent triggers warning notification with alternatives', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('testgrp')!;
		const { ctx, notifyCalls } = createContext();

		await cmd.handler('nonexistent', ctx);

		expect(sentMessages).toHaveLength(0);
		expect(notifyCalls).toHaveLength(1);
		expect(notifyCalls[0]!.severity).toBe('warning');
		expect(notifyCalls[0]!.message).toContain('nonexistent');
		expect(notifyCalls[0]!.message).toContain('bye');
		expect(notifyCalls[0]!.message).toContain('hello');
	});
});

// ---------------------------------------------------------------------------
// T034 — Escape syntax (\$ → literal $)
// ---------------------------------------------------------------------------
describe('escape syntax', () => {
	test('/testgrp escaped renders \\$ARGUMENTS as literal $ARGUMENTS', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('testgrp')!;
		const { ctx } = createContext();

		await cmd.handler('escaped Alice', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toBe('Hi Alice, use $ARGUMENTS to reference all args');
	});
});
