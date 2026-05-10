/// <reference types="vitest/globals" />
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	parseCommandArgs,
	substituteArgs,
	toKebabCase,
	parseArgsItem,
	parseArgsMetadata,
	fmString,
	formatArgsHint,
	formatSelectorLabel,
	getMissingRequiredArgs,
	loadComposerConfig,
	renderPrompt,
} from '../extensions/index';
import type { ArgsItem, NestedPrompt } from '../extensions/index';

// ---------------------------------------------------------------------------
// T010 — parseCommandArgs
// ---------------------------------------------------------------------------
describe('parseCommandArgs', () => {
	test('splits simple whitespace-separated tokens', () => {
		expect(parseCommandArgs('a b c')).toEqual(['a', 'b', 'c']);
	});

	test('handles double-quoted strings', () => {
		expect(parseCommandArgs('"hello world" foo')).toEqual(['hello world', 'foo']);
	});

	test('handles single-quoted strings', () => {
		expect(parseCommandArgs("'hello world' foo")).toEqual(['hello world', 'foo']);
	});

	test('handles mixed quoting', () => {
		expect(parseCommandArgs(`"one two" 'three four' five`)).toEqual([
			'one two',
			'three four',
			'five',
		]);
	});

	test('returns empty array for empty input', () => {
		expect(parseCommandArgs('')).toEqual([]);
	});

	test('returns empty array for whitespace-only input', () => {
		expect(parseCommandArgs('   ')).toEqual([]);
	});

	test('handles tab-separated input', () => {
		expect(parseCommandArgs('a\tb\tc')).toEqual(['a', 'b', 'c']);
	});
});

// ---------------------------------------------------------------------------
// T011 — substituteArgs
// ---------------------------------------------------------------------------
describe('substituteArgs', () => {
	test('replaces positional $1 and $2', () => {
		expect(substituteArgs('Hello $1 and $2', ['Alice', 'Bob'])).toBe(
			'Hello Alice and Bob',
		);
	});

	test('replaces $@ with all args joined', () => {
		expect(substituteArgs('All: $@', ['a', 'b', 'c'])).toBe('All: a b c');
	});

	test('replaces $ARGUMENTS with all args joined', () => {
		expect(substituteArgs('All: $ARGUMENTS', ['x', 'y'])).toBe('All: x y');
	});

	test('replaces ${@:N} slice from position N', () => {
		expect(substituteArgs('Rest: ${@:2}', ['a', 'b', 'c'])).toBe('Rest: b c');
	});

	test('replaces ${@:N:L} slice with length', () => {
		expect(substituteArgs('Mid: ${@:2:1}', ['a', 'b', 'c'])).toBe('Mid: b');
	});

	test('replaces missing positional args with empty string', () => {
		expect(substituteArgs('$1 and $2', ['only'])).toBe('only and ');
	});

	test('returns template unchanged when no placeholders', () => {
		const tpl = 'No placeholders here';
		expect(substituteArgs(tpl, ['a', 'b'])).toBe(tpl);
	});

	test('\\$ escapes dollar sign to literal $', () => {
		expect(substituteArgs('Use \\$ARGUMENTS verbatim', ['a', 'b'])).toBe('Use $ARGUMENTS verbatim');
	});

	test('\\$1 escapes positional to literal $1', () => {
		expect(substituteArgs('Literal \\$1 here', ['val'])).toBe('Literal $1 here');
	});

	test('mixed escaped and unescaped placeholders', () => {
		expect(substituteArgs('$1 then \\$ARGUMENTS end', ['x'])).toBe('x then $ARGUMENTS end');
	});
});

// ---------------------------------------------------------------------------
// T012 — toKebabCase
// ---------------------------------------------------------------------------
describe('toKebabCase', () => {
	test('removes .md suffix', () => {
		expect(toKebabCase('create.md')).toBe('create');
	});

	test('converts camelCase', () => {
		expect(toKebabCase('myCommand')).toBe('my-command');
	});

	test('converts PascalCase', () => {
		expect(toKebabCase('MyCommand')).toBe('my-command');
	});

	test('converts spaces to dashes', () => {
		expect(toKebabCase('my command')).toBe('my-command');
	});

	test('converts underscores to dashes', () => {
		expect(toKebabCase('my_command')).toBe('my-command');
	});

	test('passes through already-kebab', () => {
		expect(toKebabCase('my-command')).toBe('my-command');
	});

	test('removes special characters', () => {
		expect(toKebabCase('my!@#command')).toBe('my-command');
	});

	test('strips leading and trailing dashes', () => {
		expect(toKebabCase('-my-command-')).toBe('my-command');
	});
});

// ---------------------------------------------------------------------------
// T013 — parseArgsItem (lenient per-item parsing)
// ---------------------------------------------------------------------------
describe('parseArgsItem', () => {
	test('returns full ArgsItem when all fields present', () => {
		const w: string[] = [];
		expect(parseArgsItem({ name: 'file', required: true, hint: 'path' }, 0, 'test.md', w)).toEqual({
			name: 'file',
			required: true,
			hint: 'path',
		});
		expect(w).toHaveLength(0);
	});

	test('parses rest metadata for variadic Liquid args', () => {
		const w: string[] = [];
		expect(
			parseArgsItem(
				{ name: 'description', required: false, hint: 'freeform', type: 'string[]', rest: true },
				0,
				'test.md',
				w,
			),
		).toEqual({
			name: 'description',
			required: false,
			hint: 'freeform',
			type: 'string[]',
			rest: true,
		});
		expect(w).toHaveLength(0);
	});

	test('defaults required to false when missing', () => {
		const w: string[] = [];
		const result = parseArgsItem({ name: 'file', hint: 'path' }, 0, 'test.md', w);
		expect(result).toEqual({ name: 'file', required: false, hint: 'path' });
		expect(w).toHaveLength(1);
		expect(w[0]).toContain('missing "required"');
	});

	test('defaults hint to empty string when missing', () => {
		const w: string[] = [];
		const result = parseArgsItem({ name: 'file', required: true }, 0, 'test.md', w);
		expect(result).toEqual({ name: 'file', required: true, hint: '' });
		expect(w).toHaveLength(1);
		expect(w[0]).toContain('missing "hint"');
	});

	test('defaults both required and hint when missing', () => {
		const w: string[] = [];
		const result = parseArgsItem({ name: 'tone' }, 0, 'test.md', w);
		expect(result).toEqual({ name: 'tone', required: false, hint: '' });
		expect(w).toHaveLength(2);
	});

	test('rejects item without name', () => {
		const w: string[] = [];
		expect(parseArgsItem({ required: true, hint: 'path' }, 0, 'test.md', w)).toBeUndefined();
		expect(w).toHaveLength(1);
		expect(w[0]).toContain('missing required "name"');
	});

	test('rejects non-object item', () => {
		const w: string[] = [];
		expect(parseArgsItem('string', 0, 'test.md', w)).toBeUndefined();
		expect(w).toHaveLength(1);
		expect(w[0]).toContain('not an object');
	});

	test('rejects null item', () => {
		const w: string[] = [];
		expect(parseArgsItem(null, 0, 'test.md', w)).toBeUndefined();
		expect(w).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// T014 — parseArgsMetadata (lenient array parsing)
// ---------------------------------------------------------------------------
describe('parseArgsMetadata', () => {
	test('returns fully valid array as-is', () => {
		const valid: ArgsItem[] = [{ name: 'file', required: true, hint: 'path' }];
		const w: string[] = [];
		expect(parseArgsMetadata(valid, 'test.md', w)).toEqual(valid);
		expect(w).toHaveLength(0);
	});

	test('returns undefined for undefined (no warning)', () => {
		const w: string[] = [];
		expect(parseArgsMetadata(undefined, 'test.md', w)).toBeUndefined();
		expect(w).toHaveLength(0);
	});

	test('returns undefined for null (no warning)', () => {
		const w: string[] = [];
		expect(parseArgsMetadata(null, 'test.md', w)).toBeUndefined();
		expect(w).toHaveLength(0);
	});

	test('returns undefined with warning for non-array', () => {
		const w: string[] = [];
		expect(parseArgsMetadata('not-array', 'test.md', w)).toBeUndefined();
		expect(w).toHaveLength(1);
		expect(w[0]).toContain('must be an array');
	});

	test('keeps valid items, drops invalid ones with per-item warnings', () => {
		const w: string[] = [];
		const raw = [
			{ name: 'good', required: true, hint: 'yes' },
			{ bad: true },
			{ name: 'also-good', required: false, hint: '' },
		];
		const result = parseArgsMetadata(raw, 'test.md', w);
		expect(result).toEqual([
			{ name: 'good', required: true, hint: 'yes' },
			{ name: 'also-good', required: false, hint: '' },
		]);
		expect(w.length).toBeGreaterThanOrEqual(1);
		expect(w.some((s) => s.includes('args[1]'))).toBe(true);
	});

	test('fills in defaults for missing hint and required', () => {
		const w: string[] = [];
		const raw = [{ name: 'target' }];
		const result = parseArgsMetadata(raw, 'test.md', w);
		expect(result).toEqual([{ name: 'target', required: false, hint: '' }]);
		expect(w.length).toBe(2); // missing required + missing hint
	});

	test('returns undefined for empty array (no warning)', () => {
		const w: string[] = [];
		expect(parseArgsMetadata([], 'test.md', w)).toBeUndefined();
		expect(w).toHaveLength(0);
	});

	test('returns undefined when all items are rejected', () => {
		const w: string[] = [];
		expect(parseArgsMetadata([{ bad: true }, null], 'test.md', w)).toBeUndefined();
		expect(w.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// T014b — getMissingRequiredArgs
// ---------------------------------------------------------------------------
describe('getMissingRequiredArgs', () => {
	test('returns empty array when args metadata is absent', () => {
		expect(getMissingRequiredArgs(undefined, ['a'])).toEqual([]);
	});

	test('returns only required args missing from the provided positional list', () => {
		const args: ArgsItem[] = [
			{ name: 'target', required: true, hint: 'Who?' },
			{ name: 'tone', required: false, hint: 'Tone' },
			{ name: 'context', required: true, hint: 'Context' },
		];
		expect(getMissingRequiredArgs(args, ['alice'])).toEqual([
			{ name: 'context', required: true, hint: 'Context' },
		]);
	});
});

// ---------------------------------------------------------------------------
// T015 — fmString
// ---------------------------------------------------------------------------
describe('fmString', () => {
	test('returns string value', () => {
		expect(fmString({ title: 'hello' }, 'title')).toBe('hello');
	});

	test('returns empty string for number value', () => {
		expect(fmString({ count: 42 }, 'count')).toBe('');
	});

	test('returns empty string for boolean value', () => {
		expect(fmString({ flag: true }, 'flag')).toBe('');
	});

	test('returns empty string for missing key', () => {
		expect(fmString({}, 'missing')).toBe('');
	});
});

// ---------------------------------------------------------------------------
// T016 — formatArgsHint
// ---------------------------------------------------------------------------
describe('formatArgsHint', () => {
	test('returns empty string for undefined args', () => {
		expect(formatArgsHint(undefined)).toBe('');
	});

	test('returns empty string for empty array', () => {
		expect(formatArgsHint([])).toBe('');
	});

	test('formats required-only args', () => {
		const args: ArgsItem[] = [
			{ name: 'file', required: true, hint: 'path' },
			{ name: 'mode', required: true, hint: 'type' },
		];
		expect(formatArgsHint(args)).toBe(' [file, mode]');
	});

	test('appends ? for optional args', () => {
		const args: ArgsItem[] = [{ name: 'verbose', required: false, hint: 'flag' }];
		expect(formatArgsHint(args)).toBe(' [verbose?]');
	});

	test('formats mixed required and optional', () => {
		const args: ArgsItem[] = [
			{ name: 'file', required: true, hint: 'path' },
			{ name: 'verbose', required: false, hint: 'flag' },
		];
		expect(formatArgsHint(args)).toBe(' [file, verbose?]');
	});
});

// ---------------------------------------------------------------------------
// T017 — formatSelectorLabel
// ---------------------------------------------------------------------------
describe('formatSelectorLabel', () => {
	const basePrompt: NestedPrompt = {
		name: 'create',
		filePath: '/test/create.md',
		description: 'Create a new thing',
		args: undefined,
		content: 'body',
		origin: 'user',
		groupName: 'test',
		engine: 'pi',
		shell: 'deny',
	};

	test('formats prompt with args as "name [args] description"', () => {
		const withArgs: NestedPrompt = {
			...basePrompt,
			args: [{ name: 'file', required: true, hint: 'path' }],
		};
		expect(formatSelectorLabel(withArgs)).toBe('create [file] Create a new thing');
	});

	test('formats prompt without args as "name description"', () => {
		expect(formatSelectorLabel(basePrompt)).toBe('create Create a new thing');
	});
});

// ---------------------------------------------------------------------------
// Liquid shell blocks
// ---------------------------------------------------------------------------
describe('renderPrompt shell blocks', () => {
	const basePrompt: NestedPrompt = {
		name: 'shell',
		filePath: '/tmp/prompts/shell.md',
		description: 'Shell prompt',
		args: undefined,
		content: '{% shell %}\nprintf {{ args.value | shell_quote }}\n{% endshell %}',
		origin: 'project',
		groupName: 'ops',
		engine: 'liquid',
		shell: 'deny',
	};

	test('denies shell execution by default and renders command text', async () => {
		const rendered = await renderPrompt(basePrompt, {
			args: [],
			namedArgs: { value: 'hello world' },
			didCollectMissingArgs: false,
		});
		expect(rendered).toContain('Shell command not executed');
		expect(rendered).toContain("printf 'hello world'");
	});

	test('allow executes and injects stdout', async () => {
		const rendered = await renderPrompt(
			{ ...basePrompt, shell: 'allow' },
			{ args: [], namedArgs: { value: 'hello world' }, didCollectMissingArgs: false },
			{
				shellExecutor: async (command, cwd) => `${cwd} :: ${command}`,
			},
		);
		expect(rendered).toBe("/tmp/prompts :: printf 'hello world'");
	});

	test('ask skips when operator declines', async () => {
		const rendered = await renderPrompt(
			{ ...basePrompt, shell: 'ask' },
			{ args: [], namedArgs: { value: 'hello world' }, didCollectMissingArgs: false },
			{
				ctx: { ui: { confirm: async () => false } },
				shellExecutor: async () => 'should not run',
			},
		);
		expect(rendered).toContain('Shell command skipped by operator');
		expect(rendered).not.toContain('should not run');
	});

	test('ask executes when operator confirms', async () => {
		const rendered = await renderPrompt(
			{ ...basePrompt, shell: 'ask' },
			{ args: [], namedArgs: { value: 'hello world' }, didCollectMissingArgs: false },
			{
				ctx: { ui: { confirm: async () => true } },
				shellExecutor: async () => 'confirmed output',
			},
		);
		expect(rendered).toBe('confirmed output');
	});

	test('does not execute user-provided fake shell markers', async () => {
		const fakeMarker = '__PI_PROMPT_COMPOSER_SHELL_0_START__\nuntrusted command\n__PI_PROMPT_COMPOSER_SHELL_0_END__';
		const rendered = await renderPrompt(
			{ ...basePrompt, content: '{{ args.value }}', shell: 'allow' },
			{ args: [], namedArgs: { value: fakeMarker }, didCollectMissingArgs: false },
			{
				shellExecutor: async () => 'should not run',
			},
		);
		expect(rendered).toBe(fakeMarker);
	});
});

// ---------------------------------------------------------------------------
// Composer config
// ---------------------------------------------------------------------------
describe('loadComposerConfig', () => {
	test('uses project shell mode and timeout config', () => {
		const cwd = mkdtempSync(join(tmpdir(), 'composer-config-'));
		mkdirSync(join(cwd, '.pi'), { recursive: true });
		writeFileSync(
			join(cwd, '.pi', 'prompt-composer.json'),
			JSON.stringify({ shell: { mode: 'ask', timeoutMs: 12_345 } }),
		);
		const warnings: string[] = [];
		expect(loadComposerConfig(cwd, warnings)).toEqual({ shellMode: 'ask', shellTimeoutMs: 12_345 });
		expect(warnings).toEqual([]);
	});
});
