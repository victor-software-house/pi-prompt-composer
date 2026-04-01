/// <reference types="vitest/globals" />
import {
	parseCommandArgs,
	substituteArgs,
	toKebabCase,
	isValidArgsItem,
	parseArgsMetadata,
	fmString,
	formatArgsHint,
	formatSelectorLabel,
	getMissingRequiredArgs,
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
// T013 — isValidArgsItem
// ---------------------------------------------------------------------------
describe('isValidArgsItem', () => {
	test('returns true for valid item with all three fields', () => {
		expect(isValidArgsItem({ name: 'file', required: true, hint: 'path' })).toBe(true);
	});

	test('returns false when name is missing', () => {
		expect(isValidArgsItem({ required: true, hint: 'path' })).toBe(false);
	});

	test('returns false when required is missing', () => {
		expect(isValidArgsItem({ name: 'file', hint: 'path' })).toBe(false);
	});

	test('returns false when hint is missing', () => {
		expect(isValidArgsItem({ name: 'file', required: true })).toBe(false);
	});

	test('returns false for wrong types', () => {
		expect(isValidArgsItem({ name: 123, required: 'yes', hint: true })).toBe(false);
	});

	test('returns false for null', () => {
		expect(isValidArgsItem(null)).toBe(false);
	});

	test('returns false for non-object', () => {
		expect(isValidArgsItem('string')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// T014 — parseArgsMetadata
// ---------------------------------------------------------------------------
describe('parseArgsMetadata', () => {
	test('returns valid array as-is', () => {
		const valid: ArgsItem[] = [{ name: 'file', required: true, hint: 'path' }];
		const warnings: string[] = [];
		expect(parseArgsMetadata(valid, 'test.md', warnings)).toEqual(valid);
		expect(warnings).toHaveLength(0);
	});

	test('returns undefined for undefined (no warning)', () => {
		const warnings: string[] = [];
		expect(parseArgsMetadata(undefined, 'test.md', warnings)).toBeUndefined();
		expect(warnings).toHaveLength(0);
	});

	test('returns undefined for null (no warning)', () => {
		const warnings: string[] = [];
		expect(parseArgsMetadata(null, 'test.md', warnings)).toBeUndefined();
		expect(warnings).toHaveLength(0);
	});

	test('returns undefined with warning for non-array', () => {
		const warnings: string[] = [];
		expect(parseArgsMetadata('not-array', 'test.md', warnings)).toBeUndefined();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('expected array');
	});

	test('returns undefined with warning for array with invalid items', () => {
		const warnings: string[] = [];
		expect(parseArgsMetadata([{ bad: true }], 'test.md', warnings)).toBeUndefined();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('each item needs');
	});

	test('returns empty array as-is', () => {
		const warnings: string[] = [];
		expect(parseArgsMetadata([], 'test.md', warnings)).toEqual([]);
		expect(warnings).toHaveLength(0);
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
		scope: 'user',
		groupName: 'test',
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
