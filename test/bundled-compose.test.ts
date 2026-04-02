import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Layer 4 — Bundled /compose end-to-end tests
 *
 * These tests verify the bundled /compose command is registered, that each
 * subcommand dispatches correctly with arg substitution, and that bundled
 * commands can be overridden by project-level groups.
 *
 * The bundled prompts are loaded from the real prompts/compose/ directory
 * via resolveRelativePath(), so these tests exercise the full pipeline:
 *   discovery → registration → arg parsing → substitution → dispatch
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

// ---------------------------------------------------------------------------
// Mock infrastructure (shared shape with extension-flow.test.ts)
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
		custom: <T>(
			factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => unknown,
		) => Promise<T>;
	};
}

interface SendUserMessageCall {
	content: string;
	options: Record<string, unknown> | undefined;
}

const mockTheme = {
	fg: (_color: string, text: string) => text,
};

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
		on() {},
	};

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

function makeSelectorCustomMock(selectValue: string) {
	return async <T>(
		factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => unknown,
	): Promise<T> => {
		return new Promise<T>((resolve) => {
			const component = factory(null, mockTheme, null, resolve) as {
				children?: Array<{ onSelect?: (item: { value: string }) => void }>;
			};
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

	const originalInput = ctx.ui.input;
	ctx.ui.input = async (title, placeholder) => {
		inputCalls.push({ title, placeholder });
		return originalInput(title, placeholder);
	};

	return { ctx, notifyCalls, inputCalls };
}

// ---------------------------------------------------------------------------
// Setup — bare cwd with no project prompts
// ---------------------------------------------------------------------------

let cwd: string;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), 'pi-compose-'));
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('bundled /compose registration', () => {
	test('/compose is registered when no project prompts exist', async () => {
		const { commands } = await loadExtension(cwd);

		expect(commands.has('compose')).toBe(true);
	});

	test('/compose has correct description', async () => {
		const { commands } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;

		expect(cmd.description).toBe('Create and manage grouped prompt sets');
	});

	test('/compose has three subcommands in autocomplete', async () => {
		const { commands } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;

		const completions = cmd.getArgumentCompletions!('') as Array<{ value: string }>;
		const names = completions.map((c) => c.value).sort();

		expect(names).toEqual(['add', 'new', 'remove']);
	});
});

// ---------------------------------------------------------------------------
// /compose new — arg substitution
// ---------------------------------------------------------------------------

describe('/compose new', () => {
	test('with group-name only: $1 is substituted, ${@:2} is empty', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx } = createContext();

		await cmd.handler('new review', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0].content;

		// $1 → "review"
		expect(content).toContain('Create a new grouped prompt set named `review`.');
		expect(content).toContain('Where should the /review group live?');
		expect(content).toContain('ls -d ~/.pi/agent/prompts/review/ .pi/prompts/review/');
		expect(content).toContain('What subcommands should /review have?');
		// ${@:2} is empty when only group-name provided — shows literal \n in JSON context
		expect(content).toContain('Based on: \\n\\nEach subcommand');
		expect(sentMessages[0].options).toEqual({ deliverAs: 'followUp' });
	});

	test('with group-name and trailing description: ${@:2} captures all remaining args', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx } = createContext();

		await cmd.handler('new review Code review prompts for PR quality', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0].content;

		// $1 → "review"
		expect(content).toContain('Create a new grouped prompt set named `review`.');
		// ${@:2} → "Code review prompts for PR quality"
		expect(content).toContain('Based on: Code review prompts for PR quality');
	});

	test('with quoted group-name: quotes are stripped by arg parser', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx } = createContext();

		await cmd.handler('new "code-review" A set of review helpers', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0].content;

		expect(content).toContain('Create a new grouped prompt set named `code-review`.');
		expect(content).toContain('Based on: A set of review helpers');
	});

	test('missing required group-name: collects via input', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx, inputCalls } = createContext({
			input: async () => 'deploy',
		});

		await cmd.handler('new', ctx);

		expect(inputCalls).toHaveLength(1);
		expect(inputCalls[0].title).toContain('/compose new');
		expect(inputCalls[0].placeholder).toBe('Name for the new command group (kebab-case)');
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0].content).toContain('Create a new grouped prompt set named `deploy`.');
	});
});

// ---------------------------------------------------------------------------
// /compose add — arg substitution
// ---------------------------------------------------------------------------

describe('/compose add', () => {
	test('with group-name only: $1 substituted, ${@:2} empty', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx } = createContext();

		await cmd.handler('add review', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0].content;

		expect(content).toContain('Add subcommands to the `review` grouped prompt set.');
		expect(content).toContain('~/.pi/agent/prompts/review');
		expect(content).toContain('.pi/prompts/review');
		expect(content).toContain('/compose new review');
	});

	test('with trailing description: ${@:2} captures context', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx } = createContext();

		await cmd.handler('add review Add a checklist subcommand for security', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0].content;

		expect(content).toContain('Add subcommands to the `review` grouped prompt set.');
		expect(content).toContain('Based on: Add a checklist subcommand for security');
	});

	test('missing required group-name: collects via input', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx, inputCalls } = createContext({
			input: async () => 'deploy',
		});

		await cmd.handler('add', ctx);

		expect(inputCalls).toHaveLength(1);
		expect(inputCalls[0].placeholder).toBe('Name of the existing command group');
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0].content).toContain('Add subcommands to the `deploy` grouped prompt set.');
	});
});

// ---------------------------------------------------------------------------
// /compose remove — arg substitution
// ---------------------------------------------------------------------------

describe('/compose remove', () => {
	test('with group-name only: $1 substituted, $2 empty', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx } = createContext();

		await cmd.handler('remove review', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0].content;

		expect(content).toContain('Remove or simplify subcommands in the `review` grouped prompt set.');
		expect(content).toContain('~/.pi/agent/prompts/review');
		expect(content).toContain('.pi/prompts/review');
	});

	test('with group-name and subcommand: $1 and $2 both substituted', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx } = createContext();

		await cmd.handler('remove review checklist', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0].content;

		expect(content).toContain('Remove or simplify subcommands in the `review` grouped prompt set.');
		// $2 → "checklist" in "target that file directly"
		expect(content).toContain('(`checklist`)');
		// $2 in the grep commands
		expect(content).toContain('/review checklist');
		// $2 in the confirm question
		expect(content).toContain('How should I handle /review checklist?');
	});

	test('with no args: collects required group-name via input', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx, inputCalls } = createContext({
			input: async () => 'deploy',
		});

		// 'remove' is the subcommand, no further args → group-name is required → input collected
		await cmd.handler('remove', ctx);

		expect(inputCalls).toHaveLength(1);
		expect(inputCalls[0].placeholder).toBe('Name of the command group to modify');
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0].content).toContain('Remove or simplify subcommands in the `deploy` grouped prompt set.');
	});
});

// ---------------------------------------------------------------------------
// Bare /compose — selector flow
// ---------------------------------------------------------------------------

describe('bare /compose selector', () => {
	test('opens selector showing new, add, remove', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx } = createContext({
			custom: makeSelectorCustomMock('new'),
			input: async () => 'my-group',
		});

		await cmd.handler('', ctx);

		// Selector should trigger, then new was selected, required arg collected
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0].content).toContain('Create a new grouped prompt set named `my-group`.');
	});
});

// ---------------------------------------------------------------------------
// Bundled override by project compose
// ---------------------------------------------------------------------------

describe('bundled /compose override', () => {
	test('project-level /compose overrides bundled /compose', async () => {
		// Create a project-level compose group
		const composeDir = join(cwd, '.pi', 'prompts', 'compose');
		mkdirSync(composeDir, { recursive: true });
		writeFileSync(
			join(composeDir, '_index.md'),
			'---\ntype: group\ndescription: Custom compose\n---\n',
		);
		writeFileSync(
			join(composeDir, 'custom.md'),
			'---\ndescription: Custom operation\n---\nCustom body with $ARGUMENTS',
		);

		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;

		// Should have the project description, not bundled
		expect(cmd.description).toBe('Custom compose');

		// Should dispatch the project subcommand, not bundled ones
		const { ctx } = createContext();
		await cmd.handler('custom hello world', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0].content).toBe('Custom body with hello world');
	});

	test('project-level /compose replaces bundled autocomplete', async () => {
		const composeDir = join(cwd, '.pi', 'prompts', 'compose');
		mkdirSync(composeDir, { recursive: true });
		writeFileSync(
			join(composeDir, '_index.md'),
			'---\ntype: group\ndescription: Custom compose\n---\n',
		);
		writeFileSync(
			join(composeDir, 'alpha.md'),
			'---\ndescription: Alpha cmd\n---\nAlpha',
		);
		writeFileSync(
			join(composeDir, 'beta.md'),
			'---\ndescription: Beta cmd\n---\nBeta',
		);

		const { commands } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const completions = cmd.getArgumentCompletions!('') as Array<{ value: string }>;
		const names = completions.map((c) => c.value).sort();

		// Should show project subcommands, not bundled new/add/remove
		expect(names).toEqual(['alpha', 'beta']);
	});
});

// ---------------------------------------------------------------------------
// Unknown subcommand on bundled /compose
// ---------------------------------------------------------------------------

describe('bundled /compose unknown subcommand', () => {
	test('/compose nonexistent shows warning with available subcommands', async () => {
		const { commands, sentMessages } = await loadExtension(cwd);
		const cmd = commands.get('compose')!;
		const { ctx, notifyCalls } = createContext();

		await cmd.handler('nonexistent', ctx);

		expect(sentMessages).toHaveLength(0);
		expect(notifyCalls).toHaveLength(1);
		expect(notifyCalls[0].severity).toBe('warning');
		expect(notifyCalls[0].message).toContain('nonexistent');
		expect(notifyCalls[0].message).toContain('new');
		expect(notifyCalls[0].message).toContain('add');
		expect(notifyCalls[0].message).toContain('remove');
	});
});
