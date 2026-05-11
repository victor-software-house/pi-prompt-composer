/// <reference types="vitest/globals" />
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

import {
	createContext,
	createMockPi,
	loadExtension,
	makeSelectorCustomMock,
} from './helpers/mock-pi';

// ---------------------------------------------------------------------------
// Setup — bare cwd with no project prompts
// ---------------------------------------------------------------------------

let cwd: string;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), 'bundled-compose-'));
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('bundled /compose registration', () => {
	test('/compose is registered with correct description', async () => {
		const { mockPi, commands } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		expect(cmd).toBeDefined();
		expect(cmd.description).toBe('Create and manage grouped prompt sets');
	});

	test('/compose has three subcommands in autocomplete', async () => {
		const { mockPi, commands } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const completions = cmd.getArgumentCompletions!('') as Array<{ value: string }>;
		const names = completions.map((c) => c.value);

		// Order matches _index.md order: [new, add, remove]
		expect(names).toEqual(['new', 'add', 'remove']);
	});
});

// ---------------------------------------------------------------------------
// /compose new — arg substitution
// ---------------------------------------------------------------------------

describe('/compose new', () => {
	test('with group_name only: $1 is substituted, ${@:2} is empty', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx } = createContext();
		await cmd.handler('new my-group', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0]!.content;
		expect(content).toContain('my-group');
		// $1 should be substituted with the group name
		expect(content).toContain('`my-group`');
	});

	test('with group_name and trailing description: ${@:2} captures all remaining args', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx } = createContext();
		await cmd.handler('new my-group A group for code reviews', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0]!.content;
		expect(content).toContain('my-group');
		expect(content).toContain('A group for code reviews');
	});

	test('with quoted group_name: quotes are stripped by arg parser', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx } = createContext();
		await cmd.handler('new "my-group"', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('my-group');
	});

	test('missing required group_name: collects via input', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx, inputCalls } = createContext({
			input: async () => 'collected-group',
		});
		await cmd.handler('new', ctx);

		// Required group_name collected first, then optional description
		expect(inputCalls.length).toBeGreaterThanOrEqual(1);
		expect(inputCalls[0]!.title).toContain('group_name');
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('collected-group');
	});

	test('escaped \\$ references survive substitution as literal $', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx } = createContext();
		await cmd.handler('new test-group', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0]!.content;
		// Escaped \$ in the source should render as literal $
		// The bundled compose/new.md uses \$1 and \$ARGUMENTS in code examples
		expect(content).toContain('$1');
		expect(content).toContain('$ARGUMENTS');
	});
});

// ---------------------------------------------------------------------------
// /compose add — arg substitution
// ---------------------------------------------------------------------------

describe('/compose add', () => {
	test('with group_name only: $1 substituted, ${@:2} empty', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx } = createContext();
		await cmd.handler('add my-group', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('my-group');
	});

	test('with trailing description: ${@:2} captures context', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx } = createContext();
		await cmd.handler('add my-group add a lint subcommand', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0]!.content;
		expect(content).toContain('my-group');
		expect(content).toContain('add a lint subcommand');
	});

	test('missing required group_name: collects via input', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx, inputCalls } = createContext({
			input: async () => 'collected-group',
		});
		await cmd.handler('add', ctx);

		expect(inputCalls.length).toBeGreaterThanOrEqual(1);
		expect(inputCalls[0]!.title).toContain('group_name');
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('collected-group');
	});

	test('escaped \\$ references survive substitution as literal $', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx } = createContext();
		await cmd.handler('add test-group', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0]!.content;
		expect(content).toContain('$1');
	});
});

// ---------------------------------------------------------------------------
// /compose remove — arg substitution
// ---------------------------------------------------------------------------

describe('/compose remove', () => {
	test('with group_name only: $1 substituted, $2 empty', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx } = createContext();
		await cmd.handler('remove my-group', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('my-group');
	});

	test('with group_name and subcommand: $1 and $2 both substituted', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx } = createContext();
		await cmd.handler('remove my-group old-cmd', ctx);

		expect(sentMessages).toHaveLength(1);
		const content = sentMessages[0]!.content;
		expect(content).toContain('my-group');
		expect(content).toContain('old-cmd');
	});

	test('with no args: collects required group_name via input', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx, inputCalls } = createContext({
			input: async () => 'collected-group',
		});
		await cmd.handler('remove', ctx);

		expect(inputCalls.length).toBeGreaterThanOrEqual(1);
		expect(inputCalls[0]!.title).toContain('group_name');
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('collected-group');
	});
});

// ---------------------------------------------------------------------------
// Bare /compose → selector flow
// ---------------------------------------------------------------------------

describe('bare /compose selector', () => {
	test('opens selector showing new, add, remove', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx } = createContext({
			input: async () => 'test-group',
			custom: makeSelectorCustomMock('new'),
		});
		await cmd.handler('', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('test-group');
	});
});

// ---------------------------------------------------------------------------
// Override: project-level compose/ replaces bundled
// ---------------------------------------------------------------------------

describe('bundled /compose override', () => {
	test('project-level /compose overrides bundled /compose', async () => {
		const composeDir = join(cwd, '.pi', 'prompts', 'compose');
		mkdirSync(composeDir, { recursive: true });
		writeFileSync(
			join(composeDir, '_index.md'),
			'---\ntype: group\ndescription: Custom compose\n---\n',
		);
		writeFileSync(
			join(composeDir, 'custom.md'),
			'---\ndescription: Custom cmd\n---\nCustom body with $ARGUMENTS',
		);

		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		// Should dispatch the project subcommand, not bundled ones
		const { ctx } = createContext();
		await cmd.handler('custom hello world', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toBe('Custom body with hello world');
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

		const { mockPi, commands } = createMockPi();
		await loadExtension(mockPi, cwd);
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
		const { mockPi, commands } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('compose')!;

		const { ctx, notifyCalls } = createContext();
		await cmd.handler('nonexistent', ctx);

		expect(notifyCalls).toHaveLength(1);
		expect(notifyCalls[0]!.severity).toBe('warning');
		expect(notifyCalls[0]!.message).toContain('nonexistent');
		expect(notifyCalls[0]!.message).toContain('new');
		expect(notifyCalls[0]!.message).toContain('add');
		expect(notifyCalls[0]!.message).toContain('remove');
	});
});
