/// <reference types="vitest/globals" />
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Order field tests
 *
 * Verify that the `order` frontmatter field in _index.md controls
 * subcommand ordering in autocomplete and the selector.
 */

import { createMockPi, loadExtension } from './helpers/mock-pi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeGroup(
	dir: string,
	indexExtra: string,
	subcommands: Array<{ name: string; description: string }>,
) {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, '_index.md'), `---\ntype: group\ndescription: Test\n${indexExtra}---\n`);
	for (const sc of subcommands) {
		writeFileSync(join(dir, `${sc.name}.md`), `---\ndescription: ${sc.description}\n---\nBody of ${sc.name}`);
	}
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let cwd: string;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), 'order-'));
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('order field', () => {
	test('no order field — alphabetical', async () => {
		const dir = join(cwd, '.pi', 'prompts', 'testgrp');
		writeGroup(dir, '', [
			{ name: 'charlie', description: 'C' },
			{ name: 'alpha', description: 'A' },
			{ name: 'bravo', description: 'B' },
		]);

		const { mockPi, commands } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;
		const names = (cmd.getArgumentCompletions!('') as Array<{ value: string }>).map((c) => c.value);

		expect(names).toEqual(['alpha', 'bravo', 'charlie']);
	});

	test('order field respected — listed items first in given order', async () => {
		const dir = join(cwd, '.pi', 'prompts', 'testgrp');
		writeGroup(dir, 'order: [charlie, alpha, bravo]\n', [
			{ name: 'charlie', description: 'C' },
			{ name: 'alpha', description: 'A' },
			{ name: 'bravo', description: 'B' },
		]);

		const { mockPi, commands } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;
		const names = (cmd.getArgumentCompletions!('') as Array<{ value: string }>).map((c) => c.value);

		expect(names).toEqual(['charlie', 'alpha', 'bravo']);
	});

	test('partial order — listed first, unlisted appended alphabetically', async () => {
		const dir = join(cwd, '.pi', 'prompts', 'testgrp');
		writeGroup(dir, 'order: [bravo]\n', [
			{ name: 'charlie', description: 'C' },
			{ name: 'alpha', description: 'A' },
			{ name: 'bravo', description: 'B' },
		]);

		const { mockPi, commands } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;
		const names = (cmd.getArgumentCompletions!('') as Array<{ value: string }>).map((c) => c.value);

		expect(names).toEqual(['bravo', 'alpha', 'charlie']);
	});

	test('order with unknown name — warned and ignored', async () => {
		const dir = join(cwd, '.pi', 'prompts', 'testgrp');
		writeGroup(dir, 'order: [bravo, nonexistent, alpha]\n', [
			{ name: 'alpha', description: 'A' },
			{ name: 'bravo', description: 'B' },
		]);

		// Need to capture warnings — they surface on session_start
		const { mockPi, commands, eventHandlers } = createMockPi();
		await loadExtension(mockPi, cwd);

		const cmd = commands.get('testgrp')!;
		const names = (cmd.getArgumentCompletions!('') as Array<{ value: string }>).map((c) => c.value);

		// nonexistent is skipped, order is bravo then alpha
		expect(names).toEqual(['bravo', 'alpha']);

		// Warning should be surfaced
		const notifyCalls: string[] = [];
		const sessionStart = eventHandlers.get('session_start');
		expect(sessionStart).toBeDefined();
		await sessionStart!(undefined, {
			ui: {
				notify: (msg: string) => notifyCalls.push(msg),
				setWidget: () => {},
			},
		});
		expect(notifyCalls.some((m) => m.includes('nonexistent'))).toBe(true);
	});

	test('order is not an array — warned and falls back to alphabetical', async () => {
		const dir = join(cwd, '.pi', 'prompts', 'testgrp');
		writeGroup(dir, 'order: reverse\n', [
			{ name: 'charlie', description: 'C' },
			{ name: 'alpha', description: 'A' },
		]);

		const { mockPi, commands } = createMockPi();
		await loadExtension(mockPi, cwd);
		const cmd = commands.get('testgrp')!;
		const names = (cmd.getArgumentCompletions!('') as Array<{ value: string }>).map((c) => c.value);

		expect(names).toEqual(['alpha', 'charlie']);
	});
});
