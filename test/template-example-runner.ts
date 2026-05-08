import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseFrontmatter, stripFrontmatter } from '@earendil-works/pi-coding-agent';
import {
	parseArgsItem,
	renderPrompt,
	type ArgsItem,
	type FlatPrompt,
	type PromptOrigin,
	type ShellMode,
	type TemplateEngine,
} from '../extensions/index';

export interface TemplateExampleCase {
	description: string;
	origin?: PromptOrigin;
	file_path?: string;
	name?: string;
	engine?: TemplateEngine;
	shell?: ShellMode;
	args?: unknown[];
	cli?: string[];
	named?: Record<string, unknown>;
}

export interface TemplateExampleDir {
	name: string;
	dir: string;
	promptPath: string;
	casePath: string;
	expectedPath: string;
}

export async function discoverTemplateExamples(examplesRoot: string): Promise<TemplateExampleDir[]> {
	let entries: string[];
	try {
		entries = await readdir(examplesRoot);
	} catch {
		return [];
	}
	const out: TemplateExampleDir[] = [];
	for (const entry of entries.sort()) {
		if (entry.startsWith('.') || entry.startsWith('_')) continue;
		const dir = path.join(examplesRoot, entry);
		const promptPath = path.join(dir, 'prompt.md');
		const casePath = path.join(dir, 'case.json');
		const expectedPath = path.join(dir, 'expected.md');
		try {
			await readFile(promptPath, 'utf8');
			await readFile(casePath, 'utf8');
		} catch {
			continue;
		}
		out.push({ name: entry, dir, promptPath, casePath, expectedPath });
	}
	return out;
}

export async function loadTemplateCase(casePath: string): Promise<TemplateExampleCase> {
	return JSON.parse(await readFile(casePath, 'utf8')) as TemplateExampleCase;
}

export async function renderTemplateExample(example: TemplateExampleDir): Promise<string> {
	const exampleCase = await loadTemplateCase(example.casePath);
	const rawContent = await readFile(example.promptPath, 'utf8');
	const frontmatter = parseFrontmatter(rawContent).frontmatter;
	const args = normalizeArgs(exampleCase.args ?? readFrontmatterArray(frontmatter, 'args'), example.promptPath);
	const content = stripFrontmatter(rawContent);
	const prompt: FlatPrompt = {
		name: exampleCase.name ?? readFrontmatterString(frontmatter, 'name') ?? example.name.replace(/^\d+-/, ''),
		filePath: exampleCase.file_path ?? example.promptPath,
		description: exampleCase.description,
		args,
		content,
		origin: exampleCase.origin ?? 'project',
		engine: exampleCase.engine ?? readTemplateEngine(frontmatter),
		shell: exampleCase.shell ?? readShellMode(frontmatter),
	};

	return renderPrompt(
		prompt,
		{
			args: exampleCase.cli ?? [],
			namedArgs: exampleCase.named ?? {},
			didCollectMissingArgs: false,
		},
		{
			shellExecutor: async (command) => {
				if (command === 'date +%Y-%m-%d') return '2026-05-08';
				if (command === "python3 scripts/summarize.py --topic 'composer'") return 'python helper output: composer';
				return `mock shell output: ${command}`;
			},
		},
	);
}

export async function readTemplateExpected(example: TemplateExampleDir): Promise<string | null> {
	try {
		return await readFile(example.expectedPath, 'utf8');
	} catch {
		return null;
	}
}

export async function writeTemplateExpected(example: TemplateExampleDir, rendered: string): Promise<void> {
	await writeFile(example.expectedPath, rendered, 'utf8');
}

export function shouldUpdateTemplateExamples(): boolean {
	return process.env.UPDATE_TEMPLATE_EXAMPLES === '1';
}

function readFrontmatterString(fm: Record<string, unknown>, key: string): string | undefined {
	const value = fm[key];
	return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function readTemplateEngine(fm: Record<string, unknown>): TemplateEngine {
	const value = fm['engine'];
	return value === 'pi' || value === 'liquid' ? value : 'liquid';
}

function readShellMode(fm: Record<string, unknown>): ShellMode {
	const value = fm['shell'];
	if (value === 'allow' || value === 'ask' || value === 'deny') return value;
	if (value === true) return 'ask';
	return 'deny';
}

function readFrontmatterArray(fm: Record<string, unknown>, key: string): unknown[] {
	const value = fm[key];
	return Array.isArray(value) ? value : [];
}

function normalizeArgs(rawArgs: unknown[], filePath: string): ArgsItem[] | undefined {
	const warnings: string[] = [];
	const parsed: ArgsItem[] = [];
	for (const [index, raw] of rawArgs.entries()) {
		const arg = parseArgsItem(raw, index, filePath, warnings);
		if (arg) parsed.push(arg);
	}
	return parsed.length > 0 ? parsed : undefined;
}
