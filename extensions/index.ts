import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
	DynamicBorder,
	type ExtensionAPI,
	type ExtensionCommandContext,
	getAgentDir,
	parseFrontmatter,
	stripFrontmatter,
	type Theme,
} from '@mariozechner/pi-coding-agent';
import type { AutocompleteItem } from '@mariozechner/pi-tui';
import { Container, type SelectItem, SelectList, type SelectListTheme, Spacer, Text } from '@mariozechner/pi-tui';

// ---------------------------------------------------------------------------
// Pi-internal helper reimplementations
// Source: @mariozechner/pi-coding-agent@0.64.0
//         packages/coding-agent/src/core/prompt-templates.ts
//         https://github.com/badlogic/pi-mono
// Candidates for future extraction to a shared `pi-provider-utils` package.
// ---------------------------------------------------------------------------

/**
 * Parse command arguments respecting quoted strings (bash-style).
 * Near-verbatim copy of Pi's internal parseCommandArgs.
 */
export function parseCommandArgs(argsString: string): string[] {
	const args: string[] = [];
	let current = '';
	let inQuote: string | null = null;

	for (const char of argsString) {
		if (inQuote !== null) {
			if (char === inQuote) {
				inQuote = null;
			} else {
				current += char;
			}
		} else if (char === '"' || char === "'") {
			inQuote = char;
		} else if (char === ' ' || char === '\t') {
			if (current !== '') {
				args.push(current);
				current = '';
			}
		} else {
			current += char;
		}
	}
	if (current !== '') {
		args.push(current);
	}
	return args;
}

/** Sentinel used to protect escaped dollar signs during substitution. */
const ESCAPE_SENTINEL = '\x00ESCAPED_DOLLAR\x00';

/**
 * Substitute argument placeholders in template content.
 * Supports $1, $2, $@, $ARGUMENTS, ${@:N}, ${@:N:L}.
 * Use `\$` to produce a literal `$` (e.g. `\$ARGUMENTS` renders as `$ARGUMENTS`).
 * Near-verbatim copy of Pi's internal substituteArgs, plus escape support.
 */
export function substituteArgs(content: string, args: string[]): string {
	// Protect escaped dollar signs before any substitution
	let result = content.replace(/\\\$/g, ESCAPE_SENTINEL);

	// Replace $1, $2, etc. with positional args FIRST
	result = result.replace(/\$(\d+)/g, (_, num: string) => {
		const index = Number.parseInt(num, 10) - 1;
		return args[index] ?? '';
	});

	// Replace ${@:start} or ${@:start:length} with sliced args (bash-style)
	result = result.replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_, startStr: string, lengthStr: string | undefined) => {
		let start = Number.parseInt(startStr, 10) - 1;
		if (start < 0) start = 0;
		if (lengthStr !== undefined) {
			const length = Number.parseInt(lengthStr, 10);
			return args.slice(start, start + length).join(' ');
		}
		return args.slice(start).join(' ');
	});

	const allArgs = args.join(' ');
	result = result.replace(/\$ARGUMENTS/g, allArgs);
	result = result.replace(/\$@/g, allArgs);

	// Restore escaped dollar signs as literal $
	result = result.replaceAll(ESCAPE_SENTINEL, '$');
	return result;
}

// ---------------------------------------------------------------------------
// Grouped prompt types (data-model.md)
// ---------------------------------------------------------------------------

export type PromptScope = 'user' | 'project';

export interface PromptRoot {
	scope: PromptScope;
	rootPath: string;
}

export interface ArgsItem {
	name: string;
	required: boolean;
	hint: string;
}

export interface NestedPrompt {
	name: string;
	filePath: string;
	description: string;
	args: ArgsItem[] | undefined;
	content: string;
	scope: PromptScope;
	groupName: string;
}

export interface EffectivePromptGroup {
	name: string;
	scope: PromptScope;
	directoryPath: string;
	description: string;
	promptsByName: Map<string, NestedPrompt>;
	promptNames: string[];
}

export interface ResolvedPromptArgs {
	args: string[];
	didCollectMissingArgs: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a filename stem to lowercase kebab-case. */
export function toKebabCase(input: string): string {
	return input
		.replace(/\.md$/i, '')
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9-]/gi, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();
}

/** Validate an args array item from frontmatter. */
export function isValidArgsItem(item: unknown): item is { name: string; required: boolean; hint: string } {
	if (typeof item !== 'object' || item === null) return false;
	return (
		'name' in item &&
		typeof item.name === 'string' &&
		'required' in item &&
		typeof item.required === 'boolean' &&
		'hint' in item &&
		typeof item.hint === 'string'
	);
}

/** Validate an args array from frontmatter. Returns validated array or undefined. */
export function parseArgsMetadata(raw: unknown, filePath: string, warnings: string[]): ArgsItem[] | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!Array.isArray(raw)) {
		warnings.push(`Malformed args in ${basename(filePath)}: expected array, treating as absent`);
		return undefined;
	}
	if (!raw.every(isValidArgsItem)) {
		warnings.push(
			`Malformed args items in ${basename(filePath)}: each item needs name, required, hint; treating as absent`,
		);
		return undefined;
	}
	return raw;
}

export function getMissingRequiredArgs(args: ArgsItem[] | undefined, providedArgs: string[]): ArgsItem[] {
	if (args === undefined || args.length === 0) return [];
	return args.filter((arg, index) => arg.required && (providedArgs[index] === undefined || providedArgs[index] === ''));
}

// ---------------------------------------------------------------------------
// Discovery engine
// ---------------------------------------------------------------------------

function getPromptRoots(): PromptRoot[] {
	const roots: PromptRoot[] = [];
	const userRoot = join(getAgentDir(), 'prompts');
	const projectRoot = join(process.cwd(), '.pi', 'prompts');

	if (existsSync(userRoot)) {
		roots.push({ scope: 'user', rootPath: userRoot });
	}
	if (existsSync(projectRoot)) {
		roots.push({ scope: 'project', rootPath: projectRoot });
	}
	return roots;
}

/** Extract a string field from a frontmatter record, or return empty string. */
export function fmString(fm: Record<string, unknown>, key: string): string {
	const val = fm[key];
	return typeof val === 'string' ? val : '';
}

export function discoverGroups(roots: PromptRoot[], warnings: string[]): EffectivePromptGroup[] {
	const allCandidates: EffectivePromptGroup[] = [];

	for (const root of roots) {
		let entryNames: string[];
		try {
			entryNames = readdirSync(root.rootPath, { encoding: 'utf-8' });
		} catch {
			continue;
		}

		for (const entryName of entryNames) {
			const dirPath = join(root.rootPath, entryName);
			try {
				if (!statSync(dirPath).isDirectory()) continue;
			} catch {
				continue;
			}

			const indexPath = join(dirPath, '_index.md');

			// Hard gate: _index.md must exist with type: group
			if (!existsSync(indexPath)) continue;

			let indexContent: string;
			try {
				indexContent = readFileSync(indexPath, 'utf-8');
			} catch {
				continue;
			}

			const { frontmatter: indexFm } = parseFrontmatter(indexContent);
			if (indexFm['type'] !== 'group') {
				continue;
			}

			// Group description (recommended, warn + fallback)
			const groupDesc = fmString(indexFm, 'description');
			if (groupDesc === '') {
				warnings.push(`Group "${entryName}": _index.md missing description, using directory name as fallback`);
			}
			const effectiveGroupDesc = groupDesc === '' ? entryName : groupDesc;

			// Discover nested prompts
			const promptsByName = new Map<string, NestedPrompt>();
			let fileNames: string[];
			try {
				fileNames = readdirSync(dirPath, { encoding: 'utf-8' });
			} catch {
				continue;
			}

			for (const fileName of fileNames) {
				const filePath = join(dirPath, fileName);
				try {
					if (!statSync(filePath).isFile()) continue;
				} catch {
					continue;
				}
				if (!fileName.endsWith('.md')) continue;
				if (fileName === '_index.md') continue;
				let rawContent: string;
				try {
					rawContent = readFileSync(filePath, 'utf-8');
				} catch {
					continue;
				}

				const { frontmatter: fm } = parseFrontmatter(rawContent);
				const body = stripFrontmatter(rawContent);

				// Name: optional override, otherwise kebab-case filename stem
				const nameOverride = fmString(fm, 'name');
				const stem = fileName.replace(/\.md$/i, '');
				const effectiveName = nameOverride === '' ? toKebabCase(stem) : nameOverride;

				// Description (recommended, warn + fallback)
				const desc = fmString(fm, 'description');
				if (desc === '') {
					warnings.push(`Group "${entryName}": ${fileName} missing description, using filename stem as fallback`);
				}
				const effectiveDesc = desc === '' ? stem : desc;

				// Args (optional)
				const args = parseArgsMetadata(fm['args'], filePath, warnings);

				const prompt: NestedPrompt = {
					name: effectiveName,
					filePath,
					description: effectiveDesc,
					args,
					content: body,
					scope: root.scope,
					groupName: entryName,
				};

				promptsByName.set(effectiveName, prompt);
			}

			// Skip groups with no runnable nested prompts
			if (promptsByName.size === 0) continue;

			allCandidates.push({
				name: entryName,
				scope: root.scope,
				directoryPath: dirPath,
				description: effectiveGroupDesc,
				promptsByName,
				promptNames: [...promptsByName.keys()].sort(),
			});
		}
	}

	// Warn on duplicate group names across scopes
	const seen = new Map<string, PromptScope>();
	for (const group of allCandidates) {
		const prev = seen.get(group.name);
		if (prev !== undefined) {
			warnings.push(`Duplicate group name "${group.name}" found in both ${prev} and ${group.scope} scopes`);
		} else {
			seen.set(group.name, group.scope);
		}
	}

	return allCandidates;
}

// ---------------------------------------------------------------------------
// Format helpers for UX
// ---------------------------------------------------------------------------

export function formatArgsHint(args: ArgsItem[] | undefined): string {
	if (args === undefined || args.length === 0) return '';
	const parts = args.map((a) => (a.required ? a.name : `${a.name}?`));
	return ` [${parts.join(', ')}]`;
}

export function formatSelectorLabel(prompt: NestedPrompt): string {
	const hint = formatArgsHint(prompt.args);
	return `${prompt.name}${hint} ${prompt.description}`;
}

// ---------------------------------------------------------------------------
// Rich TUI selector component
// ---------------------------------------------------------------------------

/** Build a SelectListTheme using the runtime theme instance (jiti-safe). */
function buildSelectListTheme(theme: Theme): SelectListTheme {
	return {
		selectedPrefix: (text: string) => theme.fg('accent', text),
		selectedText: (text: string) => theme.fg('accent', text),
		description: (text: string) => theme.fg('muted', text),
		scrollInfo: (text: string) => theme.fg('muted', text),
		noMatch: (text: string) => theme.fg('muted', text),
	};
}

/** Build SelectItem[] from group prompts for the rich selector. */
function buildSelectorItems(group: EffectivePromptGroup): SelectItem[] {
	return group.promptNames.map((n) => {
		const p = group.promptsByName.get(n);
		return {
			value: n,
			label: n,
			description: p?.description ?? '',
		};
	});
}

/** Format the dynamic usage hint shown below the selector list. */
function formatUsageHint(group: EffectivePromptGroup, promptName: string, theme: Theme): string {
	const p = group.promptsByName.get(promptName);
	if (!p) return '';

	// Usage line: /group subcommand <required> [optional]
	let usage = theme.fg('dim', `  /${group.name} ${promptName}`);
	if (p.args && p.args.length > 0) {
		const argTokens = p.args.map((a) =>
			a.required ? theme.fg('accent', `<${a.name}>`) : theme.fg('muted', `[${a.name}]`),
		);
		usage += ` ${argTokens.join(' ')}`;
	}

	// Arg hints below the usage line
	const lines = [usage];
	if (p.args && p.args.length > 0) {
		for (const arg of p.args) {
			const marker = arg.required ? theme.fg('accent', '•') : theme.fg('muted', '◦');
			lines.push(`  ${marker} ${theme.fg('muted', `${arg.name} — ${arg.hint}`)}`);
		}
	}

	return lines.join('\n');
}

/**
 * Container subclass that delegates keyboard input to a SelectList child.
 * Necessary because Container itself has no handleInput.
 */
class GroupSelectorComponent extends Container {
	private selectList: SelectList;

	constructor(group: EffectivePromptGroup, theme: Theme, onSelect: (promptName: string) => void, onCancel: () => void) {
		super();

		const items = buildSelectorItems(group);

		// Top border
		this.addChild(new DynamicBorder((s: string) => theme.fg('border', s)));
		this.addChild(new Spacer(1));

		// Accent-colored title
		this.addChild(new Text(theme.fg('accent', group.description), 1, 0));
		this.addChild(new Spacer(1));

		// Rich select list — label is just the name, description is separate
		this.selectList = new SelectList(items, Math.min(items.length, 12), buildSelectListTheme(theme), {
			minPrimaryColumnWidth: 10,
			maxPrimaryColumnWidth: 24,
		});
		this.selectList.onSelect = (item) => onSelect(item.value);
		this.selectList.onCancel = () => onCancel();
		this.addChild(this.selectList);

		// Dynamic usage hint — updates on navigation
		this.addChild(new Spacer(1));
		const usageHint = new Text('', 1, 0);
		this.addChild(usageHint);

		const updateHint = (name: string) => {
			usageHint.setText(formatUsageHint(group, name, theme));
		};

		this.selectList.onSelectionChange = (item) => updateHint(item.value);

		// Show hint for the initially selected item
		if (items.length > 0 && items[0]) {
			updateHint(items[0].value);
		}

		// Keyboard hints
		this.addChild(new Spacer(1));
		const hints = [
			`${theme.fg('dim', '↑↓')} ${theme.fg('muted', 'navigate')}`,
			`${theme.fg('dim', 'enter')} ${theme.fg('muted', 'select')}`,
			`${theme.fg('dim', 'esc')} ${theme.fg('muted', 'cancel')}`,
		].join('   ');
		this.addChild(new Text(hints, 1, 0));
		this.addChild(new Spacer(1));

		// Bottom border
		this.addChild(new DynamicBorder((s: string) => theme.fg('border', s)));
	}

	handleInput(keyData: string) {
		this.selectList.handleInput(keyData);
	}
}

/** Show a rich grouped-prompt selector and return the selected prompt name. */
async function showPromptSelector(
	group: EffectivePromptGroup,
	ctx: ExtensionCommandContext,
): Promise<string | undefined> {
	return ctx.ui.custom<string | undefined>((_tui, theme, _keybindings, done) => {
		return new GroupSelectorComponent(
			group,
			theme,
			(name) => done(name),
			() => done(undefined),
		);
	});
}

// ---------------------------------------------------------------------------
// Interactive prompt helpers
// ---------------------------------------------------------------------------

async function resolvePromptArgs(
	prompt: NestedPrompt,
	providedArgs: string[],
	ctx: ExtensionCommandContext,
): Promise<ResolvedPromptArgs | undefined> {
	const resolvedArgs = [...providedArgs];
	let didCollectMissingArgs = false;

	for (const [index, arg] of (prompt.args ?? []).entries()) {
		if (!arg.required) continue;
		if (resolvedArgs[index] !== undefined && resolvedArgs[index] !== '') continue;

		let value: string | undefined;
		do {
			value = await ctx.ui.input(`/${prompt.groupName} ${prompt.name} — ${arg.name}`, arg.hint);
			if (value === undefined) return undefined;
			if (value.trim() === '') {
				ctx.ui.notify(`Argument "${arg.name}" is required`, 'warning');
			}
		} while (value.trim() === '');
		resolvedArgs[index] = value;
		didCollectMissingArgs = true;
	}

	return { args: resolvedArgs, didCollectMissingArgs };
}

// Reserved for future debugging / opt-in editor confirmation flow.
// async function editRenderedPrompt(
// 	prompt: NestedPrompt,
// 	rendered: string,
// 	ctx: ExtensionCommandContext,
// ): Promise<string | undefined> {
// 	return ctx.ui.editor(`Edit /${prompt.groupName} ${prompt.name} prompt`, rendered);
// }

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	function registerGroupedCommands() {
		const warnings: string[] = [];
		const roots = getPromptRoots();
		const groups = discoverGroups(roots, warnings);

		// Emit collected warnings
		for (const w of warnings) {
			console.warn(`[pi-prompt-composer] ${w}`);
		}

		for (const group of groups) {
			pi.registerCommand(group.name, {
				description: group.description,

				getArgumentCompletions(argumentPrefix: string): AutocompleteItem[] | null {
					const prefix = argumentPrefix.trim().toLowerCase();
					return group.promptNames
						.filter((n) => n.startsWith(prefix))
						.map((n) => {
							const prompt = group.promptsByName.get(n);
							const hint = prompt ? formatArgsHint(prompt.args) : '';
							return {
								value: n,
								label: n,
								description: prompt ? `${hint !== '' ? `${hint.trim()} ` : ''}${prompt.description}` : '',
							};
						});
				},

				async handler(argsString, ctx) {
					const trimmed = argsString.trim();

					// Bare /group -> rich selector flow
					if (trimmed === '') {
						const selectedName = await showPromptSelector(group, ctx);
						if (selectedName === undefined) return;

						const prompt = group.promptsByName.get(selectedName);
						if (prompt === undefined) return;

						const resolved = await resolvePromptArgs(prompt, [], ctx);
						if (resolved === undefined) return;

						const rendered = substituteArgs(prompt.content, resolved.args);
						pi.sendUserMessage(rendered, {
							deliverAs: 'followUp',
						});
						return;
					}

					// Direct dispatch: /group subcommand ...args
					const parsed = parseCommandArgs(trimmed);
					const subcommandName = parsed[0];
					if (subcommandName === undefined) return;

					const prompt = group.promptsByName.get(subcommandName);
					if (prompt === undefined) {
						// Unknown subcommand feedback
						const available = group.promptNames.join(', ');
						ctx.ui.notify(
							`Unknown subcommand "${subcommandName}" for /${group.name}. Available: ${available}`,
							'warning',
						);
						return;
					}

					const promptArgs = parsed.slice(1);
					const resolved = await resolvePromptArgs(prompt, promptArgs, ctx);
					if (resolved === undefined) return;

					const rendered = substituteArgs(prompt.content, resolved.args);
					pi.sendUserMessage(rendered, {
						deliverAs: 'followUp',
					});
				},
			});
		}
	}

	// Initial discovery on extension load
	registerGroupedCommands();
}
