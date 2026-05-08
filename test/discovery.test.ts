/// <reference types="vitest/globals" />
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverFlatPrompts, discoverGroups, loadSingleGroup, resolveRelativePath } from '../extensions/index';
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

function roots(origin: 'bundled' | 'user' | 'project' = 'user'): PromptRoot[] {
	return [{ origin, rootPath: rootDir }];
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
		const g = groups[0];
		expect(g.name).toBe('review');
		expect(g.origin).toBe('user');
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

	test('accepts _index.md without type: group marker', () => {
		createGroup(rootDir, 'markless', { 'cmd.md': '---\ndescription: A cmd\n---\nBody' }, '---\ndescription: Markless group\n---\n');

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);
		expect(groups).toHaveLength(1);
		expect(groups[0].name).toBe('markless');
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
		const g = groups[0];
		expect(g.promptsByName.size).toBe(2);
		expect(g.promptNames).toEqual(['build', 'deploy']);
	});
});

// ---------------------------------------------------------------------------
// T023 — Scope attribution
// ---------------------------------------------------------------------------
describe('origin attribution', () => {
	test('user root → origin: user, project root → origin: project', () => {
		const userRoot = mkdtempSync(join(tmpdir(), 'pi-user-'));
		const projRoot = mkdtempSync(join(tmpdir(), 'pi-proj-'));

		createGroup(userRoot, 'grp', { 'a.md': '---\ndescription: A\n---\nBody' });
		createGroup(projRoot, 'grp2', { 'b.md': '---\ndescription: B\n---\nBody' });

		const twoRoots: PromptRoot[] = [
			{ origin: 'user', rootPath: userRoot },
			{ origin: 'project', rootPath: projRoot },
		];
		const warnings: string[] = [];
		const groups = discoverGroups(twoRoots, warnings);

		expect(groups).toHaveLength(2);
		const userGroup = groups.find((g) => g.name === 'grp');
		const projGroup = groups.find((g) => g.name === 'grp2');
		expect(userGroup?.origin).toBe('user');
		expect(projGroup?.origin).toBe('project');

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
		expect(groups[0].description).toBe('mygrp');
		expect(warnings.some((w) => w.includes('missing description'))).toBe(true);
	});

	test('missing nested prompt description → warning + filename stem fallback', () => {
		createGroup(rootDir, 'grp', { 'my-cmd.md': '---\n---\nBody' });

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);

		expect(groups).toHaveLength(1);
		const prompt = groups[0].promptsByName.get('my-cmd');
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
		expect(groups[0].promptsByName.has('short')).toBe(true);
		expect(groups[0].promptsByName.has('long-file-name')).toBe(false);
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
		const prompt = groups[0].promptsByName.get('cmd');
		expect(prompt?.args).toEqual([{ name: 'file', required: true, hint: 'path' }]);
	});

	test('absent args → undefined (no warning)', () => {
		createGroup(rootDir, 'grp', { 'cmd.md': '---\ndescription: Cmd\n---\nBody' });

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);
		const prompt = groups[0].promptsByName.get('cmd');
		expect(prompt?.args).toBeUndefined();
		expect(warnings.filter((w) => w.includes('args'))).toHaveLength(0);
	});

	test('malformed args (not array) → undefined + warning', () => {
		createGroup(rootDir, 'grp', { 'cmd.md': '---\ndescription: Cmd\nargs: notarray\n---\nBody' });

		const warnings: string[] = [];
		const groups = discoverGroups(roots(), warnings);
		const prompt = groups[0].promptsByName.get('cmd');
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
		const prompt = groups[0].promptsByName.get('cmd');
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
			{ origin: 'user', rootPath: rootDir },
			{ origin: 'project', rootPath: root2 },
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
		const missing: PromptRoot[] = [{ origin: 'user', rootPath: '/tmp/does-not-exist-ever' }];
		const warnings: string[] = [];
		const groups = discoverGroups(missing, warnings);

		expect(groups).toHaveLength(0);
		expect(warnings).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// T028 — Exact group root (Case A)
// ---------------------------------------------------------------------------
describe('exact group root (Case A)', () => {
	test('root that is itself a valid group directory → loaded as single group', () => {
		// Create a group directory directly (not inside a parent)
		const groupDir = mkdtempSync(join(tmpdir(), 'pi-exact-compose-'));
		const composePath = join(groupDir, 'compose');
		mkdirSync(composePath, { recursive: true });
		writeFileSync(join(composePath, '_index.md'), '---\ntype: group\ndescription: Compose helpers\n---\n');
		writeFileSync(join(composePath, 'new.md'), '---\ndescription: Create new group\n---\nCreate a new group');
		writeFileSync(join(composePath, 'add.md'), '---\ndescription: Add subcommands\n---\nAdd subcommands');

		// Point root directly at the compose directory (exact group root)
		const exactRoot: PromptRoot[] = [{ origin: 'bundled', rootPath: composePath }];
		const warnings: string[] = [];
		const groups = discoverGroups(exactRoot, warnings);

		expect(groups).toHaveLength(1);
		expect(groups[0].name).toBe('compose');
		expect(groups[0].origin).toBe('bundled');
		expect(groups[0].description).toBe('Compose helpers');
		expect(groups[0].promptNames).toEqual(['add', 'new']);

		rmSync(groupDir, { recursive: true, force: true });
	});

	test('root with _index.md is consumed as exact group by location', () => {
		const dir = mkdtempSync(join(tmpdir(), 'pi-exact-markless-'));
		writeFileSync(join(dir, '_index.md'), '---\ndescription: Exact group\n---\n');
		writeFileSync(join(dir, 'cmd.md'), '---\ndescription: A cmd\n---\nBody');

		const roots: PromptRoot[] = [{ origin: 'user', rootPath: dir }];
		const warnings: string[] = [];
		const groups = discoverGroups(roots, warnings);

		expect(groups).toHaveLength(1);
		expect(groups[0].name).toBe(dir.split('/').at(-1));

		rmSync(dir, { recursive: true, force: true });
	});
});

// ---------------------------------------------------------------------------
// T029 — Bundled root override by user/project
// ---------------------------------------------------------------------------
describe('bundled root override ordering', () => {
	test('bundled root loaded first, user/project can produce same group name', () => {
		const bundledDir = mkdtempSync(join(tmpdir(), 'pi-bundled-'));
		const composeBundled = join(bundledDir, 'compose');
		mkdirSync(composeBundled, { recursive: true });
		writeFileSync(join(composeBundled, '_index.md'), '---\ntype: group\ndescription: Bundled compose\n---\n');
		writeFileSync(join(composeBundled, 'new.md'), '---\ndescription: Bundled new\n---\nBundled body');

		const userDir = mkdtempSync(join(tmpdir(), 'pi-user-override-'));
		createGroup(userDir, 'compose', {
			'new.md': '---\ndescription: User new\n---\nUser body',
			'custom.md': '---\ndescription: User custom\n---\nCustom body',
		}, '---\ntype: group\ndescription: User compose\n---\n');

		const orderedRoots: PromptRoot[] = [
			{ origin: 'bundled', rootPath: composeBundled },
			{ origin: 'user', rootPath: userDir },
		];
		const warnings: string[] = [];
		const groups = discoverGroups(orderedRoots, warnings);

		// Both should be discovered (registration handles override)
		expect(groups).toHaveLength(2);
		expect(groups[0].origin).toBe('bundled');
		expect(groups[1].origin).toBe('user');
		expect(warnings.some((w) => w.includes('Duplicate group name'))).toBe(true);

		rmSync(bundledDir, { recursive: true, force: true });
		rmSync(userDir, { recursive: true, force: true });
	});
});

// ---------------------------------------------------------------------------
// T030 — loadSingleGroup helper
// ---------------------------------------------------------------------------
describe('loadSingleGroup', () => {
	test('loads a valid group directory', () => {
		createGroup(rootDir, 'mygrp', {
			'cmd.md': '---\ndescription: A command\n---\nBody',
		});
		const warnings: string[] = [];
		const group = loadSingleGroup(join(rootDir, 'mygrp'), 'mygrp', 'user', warnings);

		expect(group).toBeDefined();
		expect(group!.name).toBe('mygrp');
		expect(group!.origin).toBe('user');
		expect(group!.promptNames).toEqual(['cmd']);
	});

	test('returns undefined for directory without _index.md', () => {
		const dir = join(rootDir, 'noindex');
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, 'cmd.md'), '---\ndescription: A cmd\n---\nBody');

		const warnings: string[] = [];
		const group = loadSingleGroup(dir, 'noindex', 'user', warnings);
		expect(group).toBeUndefined();
	});

	test('loads group without type marker', () => {
		createGroup(rootDir, 'markless', {
			'cmd.md': '---\ndescription: A cmd\n---\nBody',
		}, '---\ndescription: Markless\n---\n');
		const warnings: string[] = [];
		const group = loadSingleGroup(join(rootDir, 'markless'), 'markless', 'user', warnings);
		expect(group).toBeDefined();
		expect(group?.name).toBe('markless');
	});

	test('returns undefined for empty group', () => {
		const dir = join(rootDir, 'emptygrp');
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, '_index.md'), '---\ntype: group\ndescription: Empty\n---\n');

		const warnings: string[] = [];
		const group = loadSingleGroup(dir, 'emptygrp', 'user', warnings);
		expect(group).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// T031 — Flat composed prompt discovery
// ---------------------------------------------------------------------------
describe('flat composed prompt discovery', () => {
	test('discovers root .md files without type marker', () => {
		writeFileSync(join(rootDir, 'review.md'), '---\ndescription: Review change\n---\nReview $ARGUMENTS');
		const warnings: string[] = [];
		const prompts = discoverFlatPrompts(roots(), warnings);

		expect(prompts).toHaveLength(1);
		expect(prompts[0].name).toBe('review');
		expect(prompts[0].description).toBe('Review change');
		expect(prompts[0].engine).toBe('pi');
	});

	test('does not treat group subcommands or nested group files as flat prompts', () => {
		createGroup(rootDir, 'review', {
			'summary.md': '---\ndescription: Summary\n---\nBody',
		});
		mkdirSync(join(rootDir, 'review', 'notes'), { recursive: true });
		writeFileSync(join(rootDir, 'review', 'notes', 'draft.md'), '---\ndescription: Draft\n---\nBody');
		const warnings: string[] = [];
		const prompts = discoverFlatPrompts(roots(), warnings);

		expect(prompts).toHaveLength(0);
	});

	test('discovers nested flat prompt folders without _index.md', () => {
		mkdirSync(join(rootDir, 'workflows'), { recursive: true });
		writeFileSync(join(rootDir, 'workflows', 'review.md'), '---\ndescription: Nested review\nengine: liquid\n---\nReview {{ args.change }}');
		const warnings: string[] = [];
		const prompts = discoverFlatPrompts(roots(), warnings);

		expect(prompts).toHaveLength(1);
		expect(prompts[0].name).toBe('review');
		expect(prompts[0].engine).toBe('liquid');
	});
});

// ---------------------------------------------------------------------------
// T032 — resolveRelativePath
// ---------------------------------------------------------------------------
describe('resolveRelativePath', () => {
	test('resolves a relative path from extensions/index.ts location', () => {
		const resolved = resolveRelativePath('../prompts/compose');
		expect(resolved).toContain('prompts');
		expect(resolved).toContain('compose');
		expect(resolved).not.toContain('file://');
	});
});
