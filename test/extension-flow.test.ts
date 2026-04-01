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
 * This approach was chosen after T003 harness verification revealed that
 * @marcfargas/pi-test-harness's mock UI does not flow through to extension
 * command handler `ctx` parameters. The direct mock-API approach gives full
 * control over what the extension sees.
 */

// We import the default export (extension entry point) and rely on the
// extension discovering prompts from the filesystem via the cwd-based
// project root. To control what getPromptRoots() returns, we set
// process.cwd() during extension load.

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

function createContext(overrides?: {
	select?: MockCommandContext['ui']['select'];
	input?: MockCommandContext['ui']['input'];
	editor?: MockCommandContext['ui']['editor'];
}) {
	const notifyCalls: Array<{ message: string; severity: string }> = [];
	const inputCalls: Array<{ title: string; placeholder: string | undefined }> = [];
	const editorCalls: Array<{ title: string; prefill: string | undefined }> = [];

	const ctx: MockCommandContext = {
		ui: {
			select: overrides?.select ?? (async () => undefined),
			input: overrides?.input ?? (async () => undefined),
			editor: overrides?.editor ?? (async (_title, prefill) => prefill),
			notify: (message, severity) => {
				notifyCalls.push({ message, severity });
			},
		},
	};

	const originalInput = ctx.ui.input;
	ctx.ui.input = async (title, placeholder) => {
		inputCalls.push({ title, placeholder });
		return originalInput(title, placeholder);
	};

	const originalEditor = ctx.ui.editor;
	ctx.ui.editor = async (title, prefill) => {
		editorCalls.push({ title, prefill });
		return originalEditor(title, prefill);
	};

	return { ctx, notifyCalls, inputCalls, editorCalls };
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
		const { ctx, inputCalls, editorCalls } = createContext();

		await cmd.handler('hello arg1 arg2', ctx);

		expect(inputCalls).toHaveLength(0);
		expect(editorCalls).toHaveLength(0);
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('Hello arg1');
		expect(sentMessages[0]!.content).toContain('arg1 arg2');
		expect(sentMessages[0]!.options).toEqual({ deliverAs: 'followUp' });
	});

	test('/testgrp hello collects missing required args then dispatches rendered content', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('testgrp')!;
		const { ctx, inputCalls, editorCalls } = createContext({
			input: async () => 'world',
		});

		await cmd.handler('hello', ctx);

		expect(inputCalls).toHaveLength(1);
		expect(inputCalls[0]!.title).toContain('/testgrp hello');
		expect(inputCalls[0]!.placeholder).toBe('Who should be greeted?');
		expect(editorCalls).toHaveLength(0);
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('Hello world and world');
		expect(sentMessages[0]!.options).toEqual({ deliverAs: 'followUp' });
	});
});

// ---------------------------------------------------------------------------
// T031 — Selector flow
// ---------------------------------------------------------------------------
describe('selector flow', () => {
	test('bare /testgrp with selection collects required args and dispatches rendered content', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('testgrp')!;
		const { ctx, inputCalls, editorCalls } = createContext({
			select: async (_title, options) => options[1],
			input: async () => 'Pi user',
		});

		await cmd.handler('', ctx);

		expect(inputCalls).toHaveLength(1);
		expect(editorCalls).toHaveLength(0);
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('Hello Pi user and Pi user');
		expect(sentMessages[0]!.options).toEqual({ deliverAs: 'followUp' });
	});
});

// ---------------------------------------------------------------------------
// T032 — Selector cancellation
// ---------------------------------------------------------------------------
describe('selector cancellation', () => {
	test('bare /testgrp with cancelled selection dispatches no message', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('testgrp')!;
		const { ctx, inputCalls, editorCalls } = createContext();

		await cmd.handler('', ctx);

		expect(inputCalls).toHaveLength(0);
		expect(editorCalls).toHaveLength(0);
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
