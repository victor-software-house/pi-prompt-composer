import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgsItem, renderPrompt, type ArgsItem, type FlatPrompt, type PromptOrigin, type TemplateEngine } from '../extensions/index';

export interface TemplateExampleCase {
	description: string;
	origin?: PromptOrigin;
	file_path?: string;
	name?: string;
	engine?: TemplateEngine;
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
	const args = normalizeArgs(exampleCase.args ?? [], example.promptPath);
	const content = await readFile(example.promptPath, 'utf8');
	const prompt: FlatPrompt = {
		name: exampleCase.name ?? example.name.replace(/^\d+-/, ''),
		filePath: exampleCase.file_path ?? example.promptPath,
		description: exampleCase.description,
		args,
		content,
		origin: exampleCase.origin ?? 'project',
		engine: exampleCase.engine ?? 'liquid',
	};

	return renderPrompt(prompt, {
		args: exampleCase.cli ?? [],
		namedArgs: exampleCase.named ?? {},
		didCollectMissingArgs: false,
	});
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

function normalizeArgs(rawArgs: unknown[], filePath: string): ArgsItem[] | undefined {
	const warnings: string[] = [];
	const parsed: ArgsItem[] = [];
	for (const [index, raw] of rawArgs.entries()) {
		const arg = parseArgsItem(raw, index, filePath, warnings);
		if (arg) parsed.push(arg);
	}
	return parsed.length > 0 ? parsed : undefined;
}
