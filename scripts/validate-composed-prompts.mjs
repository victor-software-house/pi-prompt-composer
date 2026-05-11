#!/usr/bin/env node
/**
 * Validate composer-owned prompt roots.
 *
 * Checks frontmatter shape, grouped prompt indexes, Liquid syntax, shell policy,
 * and shell block syntax. This is intentionally static: it never executes prompt
 * shell blocks.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { parseFrontmatter } from '@earendil-works/pi-coding-agent';
import { createEngine } from 'pi-template-kit/liquid';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const roots = args.length > 0 ? args : ['prompts'];
const diagnostics = [];

function isRecord(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rel(path) {
	return relative(process.cwd(), path) || path;
}

function diagnostic(path, message) {
	diagnostics.push({ path, message });
}

function readPrompt(path) {
	try {
		const raw = readFileSync(path, 'utf8');
		const parsed = parseFrontmatter(raw);
		return { raw, frontmatter: parsed.frontmatter ?? {}, body: parsed.body ?? '' };
	} catch (error) {
		diagnostic(path, `failed to read or parse frontmatter: ${error instanceof Error ? error.message : String(error)}`);
		return undefined;
	}
}

function validateArgs(path, argsValue) {
	if (argsValue === undefined) return;
	if (!Array.isArray(argsValue)) {
		diagnostic(path, '`args` must be an array');
		return;
	}
	for (const [index, arg] of argsValue.entries()) {
		if (!isRecord(arg)) {
			diagnostic(path, `args[${index}] must be an object`);
			continue;
		}
		if (typeof arg.name !== 'string' || arg.name.trim() === '') diagnostic(path, `args[${index}].name is required`);
		if (typeof arg.required !== 'boolean') diagnostic(path, `args[${index}].required must be boolean`);
		if (typeof arg.hint !== 'string') diagnostic(path, `args[${index}].hint must be string`);
		if (arg.type !== undefined && !['string', 'boolean', 'number', 'enum', 'string[]'].includes(arg.type)) {
			diagnostic(path, `args[${index}].type is not supported: ${arg.type}`);
		}
		if (arg.values !== undefined && !Array.isArray(arg.values)) diagnostic(path, `args[${index}].values must be an array`);
		if (arg.rest === true && index !== argsValue.length - 1) diagnostic(path, `args[${index}].rest is only valid on the final arg`);
	}
}

function expandShellBlocksForLiquid(content) {
	let index = 0;
	return content.replace(/{%\s*shell\s*%}([\s\S]*?){%\s*endshell\s*%}/g, (_match, body) => {
		const name = `__validate_shell_${index++}`;
		return `{% capture ${name} %}${body}{% endcapture %}{{ ${name} | strip }}`;
	});
}

function validateShellBlocks(path, frontmatter, body) {
	const shellBlocks = [...body.matchAll(/{%\s*shell\s*%}([\s\S]*?){%\s*endshell\s*%}/g)];
	if (shellBlocks.length === 0) return;
	if (frontmatter.engine !== 'liquid') diagnostic(path, 'shell blocks require `engine: liquid`');
	if (!['ask', 'allow'].includes(frontmatter.shell)) diagnostic(path, 'shell blocks require `shell: ask` or `shell: allow`');
	for (const [index, match] of shellBlocks.entries()) {
		const bodyText = match[1]?.trim() ?? '';
		if (bodyText === '') diagnostic(path, `shell block ${index + 1} is empty`);
		if (/\b(curl\b[\s\S]*[>|]\s*jq\b|curl\b[\s\S]*>\s*[^&])/.test(bodyText)) {
			diagnostic(path, `shell block ${index + 1} should save curl output with -o before parsing; avoid piping/redirecting response data`);
		}
	}
}

function createPromptLiquidEngine(path) {
	const promptDir = dirname(path);
	return createEngine({
		root: [promptDir],
		partials: [join(promptDir, '_partials'), promptDir],
		layouts: [],
	});
}

function validatePrompt(path) {
	const prompt = readPrompt(path);
	if (!prompt) return;
	const { frontmatter, body } = prompt;
	if (typeof frontmatter.description !== 'string' || frontmatter.description.trim() === '') {
		diagnostic(path, '`description` frontmatter is required');
	}
	if (frontmatter.engine !== undefined && !['pi', 'liquid'].includes(frontmatter.engine)) {
		diagnostic(path, `unsupported engine: ${frontmatter.engine}`);
	}
	if (frontmatter.shell !== undefined && !['deny', 'ask', 'allow'].includes(frontmatter.shell)) {
		diagnostic(path, `unsupported shell mode: ${frontmatter.shell}`);
	}
	validateArgs(path, frontmatter.args);
	validateShellBlocks(path, frontmatter, body);
	if ((frontmatter.engine ?? 'pi') === 'liquid') {
		try {
			const liquidEngine = createPromptLiquidEngine(path);
			liquidEngine.parse(expandShellBlocksForLiquid(body), path);
		} catch (error) {
			diagnostic(path, `Liquid parse failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}

function validateGroupIndex(path, dirEntries) {
	const prompt = readPrompt(path);
	if (!prompt) return;
	const fm = prompt.frontmatter;
	if (fm.type !== 'group') diagnostic(path, '`type: group` is required for grouped prompt indexes');
	if (fm.order !== undefined) {
		if (!Array.isArray(fm.order)) {
			diagnostic(path, '`order` must be an array');
		} else {
			const promptNames = new Set(dirEntries.filter((entry) => entry.endsWith('.md') && entry !== '_index.md').map((entry) => basename(entry, '.md')));
			for (const name of fm.order) {
				if (typeof name !== 'string') diagnostic(path, '`order` entries must be strings');
				else if (!promptNames.has(name)) diagnostic(path, `order references missing subcommand: ${name}`);
			}
		}
	}
}

function walkRoot(root) {
	if (!existsSync(root)) {
		diagnostic(root, 'root does not exist');
		return;
	}
	const entries = readdirSync(root);
	for (const entry of entries) {
		const path = join(root, entry);
		const stat = statSync(path);
		if (stat.isDirectory()) {
			if (entry === '_partials') continue;
			const nestedEntries = readdirSync(path);
			const indexPath = join(path, '_index.md');
			if (existsSync(indexPath)) validateGroupIndex(indexPath, nestedEntries);
			for (const nestedEntry of nestedEntries) {
				if (nestedEntry === '_partials') continue;
				const nestedPath = join(path, nestedEntry);
				if (statSync(nestedPath).isFile() && extname(nestedPath) === '.md' && nestedEntry !== '_index.md') validatePrompt(nestedPath);
			}
			continue;
		}
		if (stat.isFile() && extname(path) === '.md') validatePrompt(path);
	}
}

for (const root of roots) walkRoot(root);

if (diagnostics.length === 0) {
	console.log(`✓ ${roots.length} prompt root(s) valid: ${roots.join(', ')}`);
	process.exit(0);
}

for (const item of diagnostics) {
	console.error(`✗ ${rel(item.path)}\n    ${item.message}`);
}
process.exit(1);
