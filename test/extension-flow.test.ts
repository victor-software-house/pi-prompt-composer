/// <reference types="vitest/globals" />
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

import {
	createContext,
	createMockPi,
	createSessionContext,
	loadExtension,
	makeCancelCustomMock,
	makeSelectorCustomMock,
} from './helpers/mock-pi';

// ---------------------------------------------------------------------------
// Fixture setup — a minimal /testgrp group
// ---------------------------------------------------------------------------

let cwd: string;
let fixtureDir: string;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), 'ext-flow-'));
	fixtureDir = join(cwd, '.pi', 'prompts', 'testgrp');
	mkdirSync(fixtureDir, { recursive: true });

	writeFileSync(
		join(fixtureDir, '_index.md'),
		'---\ntype: group\ndescription: Test group\n---\n',
	);
	writeFileSync(
		join(fixtureDir, 'hello.md'),
		[
			'---',
			'description: Say hello',
			'args:',
			'  - name: who',
			'    required: true',
			'    hint: Who to greet',
			'  - name: extra',
			'    required: false',
			'    hint: Optional extra',
			'---',
			'Hello $1! Extra: $2 All: $ARGUMENTS',
		].join('\n'),
	);
	writeFileSync(
		join(fixtureDir, 'noargs.md'),
		'---\ndescription: No args\n---\nJust a static prompt',
	);
	writeFileSync(
		join(fixtureDir, 'checks.md'),
		[
			'---',
			'description: Render repeated checks',
			'engine: liquid',
			'args:',
			'  - name: checks',
			'    required: false',
			'    type: string[]',
			'    hint: Verification checks',
			'---',
			'{% for check in args.checks %}',
			'{{ forloop.index }}. {{ check }}',
			'{% endfor %}',
		].join('\n'),
	);
	writeFileSync(
		join(fixtureDir, 'escaped.md'),
		'---\ndescription: Escape test\n---\nLiteral \\$ARGUMENTS here',
	);
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('direct dispatch', () => {
	test('/testgrp hello arg1 arg2 dispatches rendered content with deliverAs followUp', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;

		const { ctx } = createContext();
		await cmd.handler('hello arg1 arg2', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toBe('Hello arg1! Extra: arg2 All: arg1 arg2');
		expect(sentMessages[0]!.options).toEqual({ deliverAs: 'followUp' });
	});

	test('/testgrp checks preserves repeated key=value named args as a string array', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;

		const { ctx } = createContext();
		await cmd.handler('checks checks=typecheck checks=lint checks=test', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content.trim()).toBe('1. typecheck\n2. lint\n3. test');
	});

	test('/testgrp hello collects missing required args then dispatches rendered content', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;

		const { ctx, inputCalls } = createContext({
			input: async () => 'world',
		});
		await cmd.handler('hello', ctx);

		// Required 'who' collected first, then optional 'extra'
		expect(inputCalls.length).toBeGreaterThanOrEqual(1);
		expect(inputCalls[0]!.title).toContain('who');
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('Hello world!');
	});
});

describe('selector flow', () => {
	test('bare /testgrp opens custom selector and dispatches after collecting args', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;

		const { ctx, inputCalls } = createContext({
			input: async () => 'alice',
			custom: makeSelectorCustomMock('hello'),
		});
		await cmd.handler('', ctx);

		// Required 'who' collected first, then optional 'extra'
		expect(inputCalls.length).toBeGreaterThanOrEqual(1);
		expect(inputCalls[0]!.title).toContain('who');
		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toContain('Hello alice!');
	});

	test('bare /testgrp selecting prompt with no args dispatches directly', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;

		const { ctx } = createContext({
			custom: makeSelectorCustomMock('noargs'),
		});
		await cmd.handler('', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toBe('Just a static prompt');
	});
});

describe('selector cancellation', () => {
	test('bare /testgrp with cancelled selection dispatches no message', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;

		const { ctx } = createContext({
			custom: makeCancelCustomMock(),
		});
		await cmd.handler('', ctx);

		expect(sentMessages).toHaveLength(0);
	});
});

describe('unknown subcommand', () => {
	test('/testgrp nonexistent triggers warning notification with alternatives', async () => {
		const { mockPi, commands } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;

		const { ctx, notifyCalls } = createContext();
		await cmd.handler('nonexistent', ctx);

		expect(notifyCalls).toHaveLength(1);
		expect(notifyCalls[0]!.severity).toBe('warning');
		expect(notifyCalls[0]!.message).toContain('nonexistent');
		expect(notifyCalls[0]!.message).toContain('hello');
	});
});

describe('escape syntax', () => {
	test('/testgrp escaped renders \\$ARGUMENTS as literal $ARGUMENTS', async () => {
		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;

		const { ctx } = createContext();
		await cmd.handler('escaped foo bar', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toBe('Literal $ARGUMENTS here');
	});
});

describe('composed flat prompts', () => {
	test('/review dispatches a flat pi-engine prompt from .pi/composed', async () => {
		const composedDir = join(cwd, '.pi', 'composed');
		mkdirSync(composedDir, { recursive: true });
		writeFileSync(join(composedDir, 'review.md'), '---\ndescription: Review change\n---\nReview: $ARGUMENTS');

		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('review')!;

		const { ctx } = createContext();
		await cmd.handler('fix auth', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toBe('Review: fix auth');
	});

	test('pi-engine prompts preserve --flag and key=value as positional args', async () => {
		const composedDir = join(cwd, '.pi', 'composed');
		mkdirSync(composedDir, { recursive: true });
		writeFileSync(join(composedDir, 'args.md'), '---\ndescription: Echo args\n---\nArgs: $ARGUMENTS');

		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('args')!;

		const { ctx } = createContext();
		await cmd.handler('--force FOO=bar', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toBe('Args: --force FOO=bar');
	});

	test('/plan renders liquid with named args', async () => {
		const composedDir = join(cwd, '.pi', 'composed');
		mkdirSync(composedDir, { recursive: true });
		writeFileSync(
			join(composedDir, 'plan.md'),
			[
				'---',
				'description: Plan change',
				'engine: liquid',
				'args:',
				'  - name: change',
				'    required: true',
				'    hint: Change to plan',
				'---',
				'Plan {{ args.change | quote }} for {{ prompt.name }}',
			].join('\n'),
		);

		const { mockPi, commands, sentMessages } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('plan')!;

		const { ctx } = createContext();
		await cmd.handler('--change "fix auth"', ctx);

		expect(sentMessages).toHaveLength(1);
		expect(sentMessages[0]!.content).toBe('Plan "fix auth" for plan');
	});
});

describe('legacy migration', () => {
	test('moves .pi/prompts/<group> to .pi/composed/<group> before registration', async () => {
		const { mockPi, commands, eventHandlers } = createMockPi();
		await loadExtension(mockPi, cwd);

		expect(commands.has('testgrp')).toBe(true);
		expect(existsSync(join(cwd, '.pi', 'composed', 'testgrp'))).toBe(true);
		expect(existsSync(join(cwd, '.pi', 'prompts', 'testgrp'))).toBe(false);

		const session = createSessionContext();
		await eventHandlers.get('session_start')?.({}, session.ctx);
		expect(session.notifyCalls.some((call) => call.message.includes('Migrated legacy grouped prompt'))).toBe(true);
	});
});
