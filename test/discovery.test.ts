/// <reference types="vitest/globals" />
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverGroups } from '../extensions/index';
import type { PromptRoot } from '../extensions/index';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let rootDir: string;

beforeEach(() => {
	rootDir = mkdtempSync(join(tmpdir(), 'pi-discovery-'));
});

afterEach(() => {
	rmSync(rootDir, { recursive: true, force: true });
});

function createGroup(
	root: string,
	name: string,
	prompts: Record<string, string>,
	indexContent = '---\ntype: group\ndescription: Test group\n---\n',
) {
	const groupDir = join(root, name);
	mkdirSync(groupDir, { recursive: true });
	writeFileSync(join(groupDir, '_index.md'), indexContent);
	for (const [fileName, content] of Object.entries(prompts)) {
		writeFileSync(join(groupDir, fileName), content);
	}
}

function roots(scope: 'user' | 'project' = 'user'): PromptRoot[] {
	return [{ scope, rootPath: rootDir }];
}

// ---------------------------------------------------------------------------
// T020 — Group recognition
// ---------------------------------------------------------------------------
describe('group recognition', () => {
	test('registers directory with valid _index.md and nested .md files', () => {
		createGroup(rootDir, 'review', {
			'summary.md': '---\ndescription: Summarize\n---\nBody',
			'fix.md': '---\ndescription: Fix issues\n---\nBody',
		});
		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);

		expect(groups).toHaveLength(1);
		const g = groups[0]!;
		expect(g.name).toBe('review');
		expect(g.scope).toBe('user');
		expect(g.directoryPath).toBe(join(rootDir, 'review'));
		expect(g.description).toBe('Test group');
		expect(g.promptsByName.size).toBe(2);
		expect(g.promptNames).toEqual(['fix', 'summary']);
	});
});

// ---------------------------------------------------------------------------
// T021 — Group rejection
// ---------------------------------------------------------------------------
describe('group rejection', () => {
	test('skips directory without _index.md', () => {
		const groupDir = join(rootDir, 'noindex');
		mkdirSync(groupDir, { recursive: true });
		writeFileSync(join(groupDir, 'cmd.md'), '---\ndescription: A cmd\n---\nBody');

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);
		expect(groups).toHaveLength(0);
	});

	test('skips _index.md with wrong type', () => {
		createGroup(rootDir, 'wrongtype', { 'cmd.md': '---\ndescription: A cmd\n---\nBody' }, '---\ntype: prompt\ndescription: Not a group\n---\n');

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);
		expect(groups).toHaveLength(0);
	});

	test('skips group with no nested .md files (empty group)', () => {
		const groupDir = join(rootDir, 'emptygroup');
		mkdirSync(groupDir, { recursive: true });
		writeFileSync(join(groupDir, '_index.md'), '---\ntype: group\ndescription: Empty\n---\n');

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);
		expect(groups).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// T022 — Nested prompt filtering
// ---------------------------------------------------------------------------
describe('nested prompt filtering', () => {
	test('registers .md files, excludes _index.md, ignores non-md and subdirs', () => {
		createGroup(rootDir, 'tools', {
			'build.md': '---\ndescription: Build\n---\nBody',
			'deploy.md': '---\ndescription: Deploy\n---\nBody',
		});
		// Add non-md files
		writeFileSync(join(rootDir, 'tools', 'notes.txt'), 'text file');
		writeFileSync(join(rootDir, 'tools', 'config.json'), '{}');
		// Add subdirectory
		mkdirSync(join(rootDir, 'tools', 'subdir'));
		writeFileSync(join(rootDir, 'tools', 'subdir', 'nested.md'), 'nested');

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);

		expect(groups).toHaveLength(1);
		const g = groups[0]!;
		expect(g.promptsByName.size).toBe(2);
		expect(g.promptNames).toEqual(['build', 'deploy']);
	});
});

// ---------------------------------------------------------------------------
// T023 — Scope attribution
// ---------------------------------------------------------------------------
describe('scope attribution', () => {
	test('user root → scope: user, project root → scope: project', () => {
		const userRoot = mkdtempSync(join(tmpdir(), 'pi-user-'));
		const projRoot = mkdtempSync(join(tmpdir(), 'pi-proj-'));

		createGroup(userRoot, 'grp', { 'a.md': '---\ndescription: A\n---\nBody' });
		createGroup(projRoot, 'grp2', { 'b.md': '---\ndescription: B\n---\nBody' });

		const twoRoots: PromptRoot[] = [
			{ scope: 'user', rootPath: userRoot },
			{ scope: 'project', rootPath: projRoot },
		];
		const warnings: string[] = [];
		const groups = discoverGroups(twoRoots, warnings);

		expect(groups).toHaveLength(2);
		const userGroup = groups.find((g) => g.name === 'grp');
		const projGroup = groups.find((g) => g.name === 'grp2');
		expect(userGroup?.scope).toBe('user');
		expect(projGroup?.scope).toBe('project');

		rmSync(userRoot, { recursive: true, force: true });
		rmSync(projRoot, { recursive: true, force: true });
	});
});

// ---------------------------------------------------------------------------
// T024 — Metadata fallbacks
// ---------------------------------------------------------------------------
describe('metadata fallbacks', () => {
	test('missing group description → warning + directory name fallback', () => {
		createGroup(rootDir, 'mygrp', { 'cmd.md': '---\ndescription: Cmd\n---\nBody' }, '---\ntype: group\n---\n');

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);

		expect(groups).toHaveLength(1);
		expect(groups[0]!.description).toBe('mygrp');
		expect(warnings.some((w) => w.includes('missing description'))).toBe(true);
	});

	test('missing nested prompt description → warning + filename stem fallback', () => {
		createGroup(rootDir, 'grp', { 'my-cmd.md': '---\n---\nBody' });

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);

		expect(groups).toHaveLength(1);
		const prompt = groups[0]!.promptsByName.get('my-cmd');
		expect(prompt?.description).toBe('my-cmd');
		expect(warnings.some((w) => w.includes('missing description'))).toBe(true);
	});

	test('nested prompt with name override uses override', () => {
		createGroup(rootDir, 'grp', {
			'LongFileName.md': '---\nname: short\ndescription: Short cmd\n---\nBody',
		});

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);

		expect(groups).toHaveLength(1);
		expect(groups[0]!.promptsByName.has('short')).toBe(true);
		expect(groups[0]!.promptsByName.has('long-file-name')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// T025 — Args metadata
// ---------------------------------------------------------------------------
describe('args metadata', () => {
	test('valid args array → parsed on prompt', () => {
		const fm = `---
description: Cmd
args:
  - name: file
    required: true
    hint: path
---
Body`;
		createGroup(rootDir, 'grp', { 'cmd.md': fm });

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);
		const prompt = groups[0]!.promptsByName.get('cmd');
		expect(prompt?.args).toEqual([{ name: 'file', required: true, hint: 'path' }]);
	});

	test('absent args → undefined (no warning)', () => {
		createGroup(rootDir, 'grp', { 'cmd.md': '---\ndescription: Cmd\n---\nBody' });

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);
		const prompt = groups[0]!.promptsByName.get('cmd');
		expect(prompt?.args).toBeUndefined();
		expect(warnings.filter((w) => w.includes('args'))).toHaveLength(0);
	});

	test('malformed args (not array) → undefined + warning', () => {
		createGroup(rootDir, 'grp', { 'cmd.md': '---\ndescription: Cmd\nargs: notarray\n---\nBody' });

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);
		const prompt = groups[0]!.promptsByName.get('cmd');
		expect(prompt?.args).toBeUndefined();
		expect(warnings.some((w) => w.includes('must be an array'))).toBe(true);
	});

	test('invalid items in args array → dropped with per-item warning', () => {
		const fm = `---
description: Cmd
args:
  - bad: true
---
Body`;
		createGroup(rootDir, 'grp', { 'cmd.md': fm });

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);
		const prompt = groups[0]!.promptsByName.get('cmd');
		expect(prompt?.args).toBeUndefined();
		expect(warnings.some((w) => w.includes('missing required "name"'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// T026 — Duplicate group names
// ---------------------------------------------------------------------------
describe('duplicate group names', () => {
	test('same name in two roots → both registered + warning', () => {
		const root2 = mkdtempSync(join(tmpdir(), 'pi-dup-'));
		createGroup(rootDir, 'shared', { 'a.md': '---\ndescription: A\n---\nBody' });
		createGroup(root2, 'shared', { 'b.md': '---\ndescription: B\n---\nBody' });

		const twoRoots: PromptRoot[] = [
			{ scope: 'user', rootPath: rootDir },
			{ scope: 'project', rootPath: root2 },
		];
		const warnings: string[] = [];
		const groups = discoverGroups(twoRoots, warnings);

		expect(groups).toHaveLength(2);
		expect(warnings.some((w) => w.includes('Duplicate group name'))).toBe(true);

		rmSync(root2, { recursive: true, force: true });
	});
});

// ---------------------------------------------------------------------------
// T027 — Nonexistent root
// ---------------------------------------------------------------------------
describe('nonexistent root', () => {
	test('root pointing to missing directory → skipped silently', () => {
		const missing: PromptRoot[] = [{ scope: 'user', rootPath: '/tmp/does-not-exist-ever' }];
		const warnings: string[] = [];
		const groups = discoverGroups(missing, warnings);

		expect(groups).toHaveLength(0);
		expect(warnings).toHaveLength(0);
	});
});
