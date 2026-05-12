import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	DynamicBorder,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	getAgentDir,
	parseFrontmatter,
	stripFrontmatter,
	type Theme,
} from '@earendil-works/pi-coding-agent';
import type { AutocompleteItem } from '@earendil-works/pi-tui';
import { Container, type SelectItem, SelectList, type SelectListTheme, Spacer, Text } from '@earendil-works/pi-tui';
import { createEngine } from 'pi-template-kit/liquid';

// ---------------------------------------------------------------------------
// Pi-internal helper reimplementations
// Source reference: @earendil-works/pi-coding-agent prompt-template internals
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

export type PromptOrigin = 'bundled' | 'user' | 'project';

export interface PromptRoot {
	origin: PromptOrigin;
	rootPath: string;
}

export type TemplateEngine = 'pi' | 'liquid';
export type ShellMode = 'deny' | 'ask' | 'allow';

export interface ComposerConfig {
	shellMode: ShellMode;
	shellTimeoutMs: number;
}

const DEFAULT_COMPOSER_CONFIG: ComposerConfig = {
	shellMode: 'deny',
	shellTimeoutMs: 30_000,
};

let activeComposerConfig: ComposerConfig = DEFAULT_COMPOSER_CONFIG;

export interface ArgsItem {
	name: string;
	required: boolean;
	hint: string;
	type?: 'string' | 'boolean' | 'number' | 'enum' | 'string[]';
	values?: string[];
	defaultValue?: unknown;
	rest?: boolean;
}

export interface NestedPrompt {
	name: string;
	filePath: string;
	description: string;
	args: ArgsItem[] | undefined;
	variables: Record<string, unknown> | undefined;
	content: string;
	origin: PromptOrigin;
	groupName: string;
	engine: TemplateEngine;
	shell: ShellMode;
}

export interface FlatPrompt {
	name: string;
	filePath: string;
	description: string;
	args: ArgsItem[] | undefined;
	variables: Record<string, unknown> | undefined;
	content: string;
	origin: PromptOrigin;
	engine: TemplateEngine;
	shell: ShellMode;
}

export interface EffectivePromptGroup {
	name: string;
	origin: PromptOrigin;
	directoryPath: string;
	description: string;
	promptsByName: Map<string, NestedPrompt>;
	promptNames: string[];
}

export interface ResolvedPromptArgs {
	args: string[];
	namedArgs: Record<string, unknown>;
	didCollectMissingArgs: boolean;
}

export interface RenderPromptOptions {
	pi?: Pick<ExtensionAPI, 'exec'>;
	ctx?: Pick<ExtensionCommandContext, 'ui'>;
	shellExecutor?: (command: string, cwd: string) => Promise<string>;
	shellTimeoutMs?: number;
}

interface ParsedPromptArgs {
	positionals: string[];
	named: Record<string, string | boolean | string[]>;
}

// ---------------------------------------------------------------------------
// Required tools — persistent widget guard
// ---------------------------------------------------------------------------

/** Tools that grouped prompts expect to be available at runtime. */
const REQUIRED_TOOLS: readonly { tool: string; package: string }[] = [{ tool: 'ask_user', package: 'pi-ask-user' }];

const WIDGET_KEY = 'prompt-composer-missing-tools';

/**
 * Check whether all required tools are registered and active, then
 * show/hide a persistent warning widget accordingly.
 *
 * Three states per tool:
 *   1. Not installed  — not in getAllTools()     → suggest `pi install npm:<pkg>`
 *   2. Disabled       — in getAllTools() but not  → suggest `/tools` to re-enable
 *                        in getActiveTools()
 *   3. Active         — in both                  → all good
 *
 * Non-blocking — prompt dispatch continues regardless.
 */
function checkRequiredTools(pi: ExtensionAPI, ctx: ExtensionContext): void {
	const activeToolNames = new Set(pi.getActiveTools());
	const unavailable = REQUIRED_TOOLS.filter((r) => !activeToolNames.has(r.tool));

	if (unavailable.length === 0) {
		ctx.ui.setWidget(WIDGET_KEY, undefined);
		return;
	}

	// Only call getAllTools() when something is missing — distinguish "not installed" from "disabled"
	const allToolNames = new Set(pi.getAllTools().map((t) => t.name));
	const notInstalled = unavailable.filter((r) => !allToolNames.has(r.tool));
	const disabled = unavailable.filter((r) => allToolNames.has(r.tool));

	if (notInstalled.length === 0 && disabled.length === 0) {
		ctx.ui.setWidget(WIDGET_KEY, undefined);
		return;
	}

	ctx.ui.setWidget(WIDGET_KEY, (_tui, theme) => {
		const container = new Container();
		container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));

		const segments: string[] = [];

		if (notInstalled.length > 0) {
			const names = notInstalled.map((m) => theme.fg('accent', m.tool)).join(', ');
			const pkgs = notInstalled.map((m) => `npm:${m.package}`).join(' ');
			segments.push(
				`${theme.fg('warning', 'Not installed:')} ${names}` +
					`${theme.fg('dim', ' — run ')}${theme.fg('accent', `pi install ${pkgs}`)}`,
			);
		}

		if (disabled.length > 0) {
			const names = disabled.map((m) => theme.fg('accent', m.tool)).join(', ');
			segments.push(
				`${theme.fg('warning', 'Disabled:')} ${names}` + `${theme.fg('dim', ' — enable in tool configuration')}`,
			);
		}

		container.addChild(new Text(` ${segments.join('  ')}`, 1, 0));
		container.addChild(new DynamicBorder((s: string) => theme.fg('warning', s)));
		return container;
	});
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

/** Safely read a property from an unknown object for lenient parsing. */
function readProp(obj: object, key: string): unknown {
	if (!Object.hasOwn(obj, key)) return undefined;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- isolated runtime-safe index read
	return (obj as Record<string, unknown>)[key];
}

function stringifyScalar(value: unknown): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
	if (value === null || value === undefined) return '';
	try {
		return JSON.stringify(value);
	} catch {
		return Object.prototype.toString.call(value);
	}
}

/**
 * Leniently parse a single args item from frontmatter.
 * - `name` (string) is required — items without it are rejected.
 * - `required` defaults to `false` if missing or non-boolean.
 * - `hint` defaults to `''` if missing or non-string.
 * Returns the normalized ArgsItem, or `undefined` with a warning.
 */
export function parseArgsItem(
	item: unknown,
	index: number,
	filePath: string,
	warnings: string[],
): ArgsItem | undefined {
	if (typeof item !== 'object' || item === null) {
		warnings.push(`${basename(filePath)}: args[${index}] is not an object, skipping`);
		return undefined;
	}
	const rawName = readProp(item, 'name');
	const rawRequired = readProp(item, 'required');
	const rawHint = readProp(item, 'hint');
	const rawType = readProp(item, 'type');
	const rawValues = readProp(item, 'values');
	const rawDefault = readProp(item, 'default');
	const rawRest = readProp(item, 'rest');

	if (typeof rawName !== 'string' || rawName.trim() === '') {
		warnings.push(`${basename(filePath)}: args[${index}] missing required "name" field, skipping`);
		return undefined;
	}

	const name = rawName;
	const required = typeof rawRequired === 'boolean' ? rawRequired : false;
	const hint = typeof rawHint === 'string' ? rawHint : '';
	const type =
		rawType === 'string' ||
		rawType === 'boolean' ||
		rawType === 'number' ||
		rawType === 'enum' ||
		rawType === 'string[]'
			? rawType
			: undefined;
	const values = Array.isArray(rawValues)
		? rawValues.filter((value): value is string => typeof value === 'string')
		: undefined;

	if (rawRequired === undefined) {
		warnings.push(`${basename(filePath)}: args[${index}] "${name}" missing "required", defaulting to false`);
	}
	if (rawHint === undefined || typeof rawHint !== 'string') {
		warnings.push(`${basename(filePath)}: args[${index}] "${name}" missing "hint", recommended for better UX`);
	}

	if (rawType !== undefined && type === undefined) {
		warnings.push(
			`${basename(filePath)}: args[${index}] "${name}" has unsupported type "${stringifyScalar(rawType)}", defaulting to string`,
		);
	}
	if (rawValues !== undefined && values === undefined) {
		warnings.push(`${basename(filePath)}: args[${index}] "${name}" values must be a string array, ignoring`);
	}
	if (rawRest !== undefined && typeof rawRest !== 'boolean') {
		warnings.push(`${basename(filePath)}: args[${index}] "${name}" rest must be boolean, ignoring`);
	}

	const parsed: ArgsItem = { name, required, hint };
	if (type !== undefined) parsed.type = type;
	if (values !== undefined) parsed.values = values;
	if (rawDefault !== undefined) parsed.defaultValue = rawDefault;
	if (typeof rawRest === 'boolean') parsed.rest = rawRest;
	return parsed;
}

/** Parse an args array from frontmatter. Lenient: keeps valid items, warns per-item. */
export function parseArgsMetadata(raw: unknown, filePath: string, warnings: string[]): ArgsItem[] | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!Array.isArray(raw)) {
		warnings.push(`${basename(filePath)}: args must be an array, ignoring`);
		return undefined;
	}

	const result: ArgsItem[] = [];
	for (let i = 0; i < raw.length; i++) {
		const parsed = parseArgsItem(raw[i], i, filePath, warnings);
		if (parsed !== undefined) {
			result.push(parsed);
		}
	}

	return result.length > 0 ? result : undefined;
}

export function parseVariablesMetadata(
	raw: unknown,
	filePath: string,
	warnings: string[],
): Record<string, unknown> | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!isRecord(raw)) {
		warnings.push(`${basename(filePath)}: variables must be an object, ignoring`);
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

/**
 * Resolve a path relative to this source file.
 * Portable across Node and packaged npm installs.
 */
export function resolveRelativePath(relativePath: string): string {
	return fileURLToPath(new URL(relativePath, import.meta.url));
}

interface LegacyMigrationRoot {
	origin: Extract<PromptOrigin, 'user' | 'project'>;
	legacyRoot: string;
	composedRoot: string;
}

function migrateLegacyPromptGroups(roots: LegacyMigrationRoot[], warnings: string[]): PromptRoot[] {
	const fallbackRoots: PromptRoot[] = [];

	for (const root of roots) {
		if (!existsSync(root.legacyRoot)) continue;

		let entryNames: string[];
		try {
			entryNames = readdirSync(root.legacyRoot, { encoding: 'utf-8' });
		} catch {
			continue;
		}

		for (const entryName of entryNames) {
			const source = join(root.legacyRoot, entryName);
			try {
				if (!statSync(source).isDirectory()) continue;
			} catch {
				continue;
			}
			if (!existsSync(join(source, '_index.md'))) continue;

			const target = join(root.composedRoot, entryName);
			if (existsSync(target)) {
				warnings.push(
					`Legacy grouped prompt ${source} was not migrated because ${target} already exists; resolve the collision manually. Legacy prompt migration is deprecated and will be removed in the next major release.`,
				);
				continue;
			}

			try {
				mkdirSync(dirname(target), { recursive: true });
				renameSync(source, target);
				warnings.push(
					`Migrated legacy grouped prompt ${source} to ${target}. Legacy .pi/prompts/<group>/ migration is deprecated and will be removed in the next major release.`,
				);
			} catch {
				warnings.push(
					`Could not migrate legacy grouped prompt ${source} to ${target}; reading it for this session only. Move it to the composed root manually. Legacy prompt migration is deprecated and will be removed in the next major release.`,
				);
				fallbackRoots.push({ origin: root.origin, rootPath: root.legacyRoot });
			}
		}
	}

	return fallbackRoots;
}

function detectMisplacedNativeComposerPrompts(roots: PromptRoot[], warnings: string[]): void {
	for (const root of roots) {
		if (!existsSync(root.rootPath)) continue;
		let entryNames: string[];
		try {
			entryNames = readdirSync(root.rootPath, { encoding: 'utf-8' });
		} catch {
			continue;
		}

		for (const entryName of entryNames) {
			if (!entryName.endsWith('.md')) continue;
			const filePath = join(root.rootPath, entryName);
			try {
				if (!statSync(filePath).isFile()) continue;
			} catch {
				continue;
			}
			let raw: string;
			try {
				raw = readFileSync(filePath, 'utf-8');
			} catch {
				continue;
			}
			const fm = safeParseFrontmatter(raw, `Native prompt ${filePath}`, warnings);
			if (fm && isComposerStyleFrontmatter(fm)) {
				const composedPath = join(dirname(root.rootPath), 'composed', entryName);
				warnings.push(
					`Composer-style prompt ${filePath} is under Pi's native prompt root. Move it to ${composedPath} so pi-prompt-composer owns /${toKebabCase(entryName)} without native prompt duplication.`,
				);
			}
		}
	}
}

/**
 * Build the ordered list of prompt roots.
 *
 * Order matters — later command registrations within the same extension
 * override earlier ones (Map.set semantics), so:
 *   1. bundled compose/ (lowest precedence)
 *   2. user composed prompts
 *   3. project composed prompts (highest precedence)
 */
function getPromptRoots(warnings: string[] = []): PromptRoot[] {
	const roots: PromptRoot[] = [];

	// Bundled compose/ group root (exact group root — Case A)
	const bundledCompose = resolveRelativePath('../prompts/compose');
	if (existsSync(bundledCompose)) {
		roots.push({ origin: 'bundled', rootPath: bundledCompose });
	}

	const userAgentDir = getAgentDir();
	const migrationFallbackRoots = migrateLegacyPromptGroups(
		[
			{
				origin: 'user',
				legacyRoot: join(userAgentDir, 'prompts'),
				composedRoot: join(userAgentDir, 'composed'),
			},
			{
				origin: 'project',
				legacyRoot: join(process.cwd(), '.pi', 'prompts'),
				composedRoot: join(process.cwd(), '.pi', 'composed'),
			},
		],
		warnings,
	);

	// User composer root (parent root — Case B)
	const userRoot = join(userAgentDir, 'composed');
	if (existsSync(userRoot)) {
		roots.push({ origin: 'user', rootPath: userRoot });
	}

	// Project composer root (parent root — Case B)
	const projectRoot = join(process.cwd(), '.pi', 'composed');
	if (existsSync(projectRoot)) {
		roots.push({ origin: 'project', rootPath: projectRoot });
	}

	roots.push(...migrationFallbackRoots);
	detectMisplacedNativeComposerPrompts(
		[
			{ origin: 'user', rootPath: join(userAgentDir, 'prompts') },
			{ origin: 'project', rootPath: join(process.cwd(), '.pi', 'prompts') },
		],
		warnings,
	);

	return roots;
}

/**
 * Safely parse frontmatter from markdown content.
 * Returns the parsed record, or undefined (with a warning) on malformed YAML.
 */
function safeParseFrontmatter(content: string, label: string, warnings: string[]): Record<string, unknown> | undefined {
	try {
		return parseFrontmatter(content).frontmatter;
	} catch {
		warnings.push(`${label}: malformed frontmatter, skipping`);
		return undefined;
	}
}

/** Extract a string field from a frontmatter record, or return empty string. */
export function fmString(fm: Record<string, unknown>, key: string): string {
	const val = fm[key];
	return typeof val === 'string' ? val : '';
}

function parseTemplateEngine(fm: Record<string, unknown>, filePath: string, warnings: string[]): TemplateEngine {
	const raw = fm['engine'];
	if (raw === undefined || raw === null || raw === '') return 'pi';
	if (raw === 'pi' || raw === 'liquid') return raw;
	warnings.push(`${basename(filePath)}: unknown engine "${stringifyScalar(raw)}", defaulting to pi`);
	return 'pi';
}

function parseShellModeValue(raw: unknown): ShellMode | undefined {
	if (raw === undefined || raw === null || raw === '') return undefined;
	if (raw === false || raw === 'deny') return 'deny';
	if (raw === true || raw === 'ask') return 'ask';
	if (raw === 'allow') return 'allow';
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeComposerConfig(raw: unknown, warnings: string[], sourceLabel: string): ComposerConfig {
	if (raw === undefined) return DEFAULT_COMPOSER_CONFIG;
	if (!isRecord(raw)) {
		warnings.push(`${sourceLabel}: config must be a JSON object, using defaults`);
		return DEFAULT_COMPOSER_CONFIG;
	}
	const shellRecord = isRecord(raw['shell']) ? raw['shell'] : undefined;
	const shellMode = parseShellModeValue(raw['shellMode'] ?? raw['defaultShellMode'] ?? shellRecord?.['mode']);
	if (
		shellMode === undefined &&
		(raw['shellMode'] !== undefined || raw['defaultShellMode'] !== undefined || shellRecord?.['mode'] !== undefined)
	) {
		warnings.push(`${sourceLabel}: unknown shell mode, using ${DEFAULT_COMPOSER_CONFIG.shellMode}`);
	}
	const rawTimeout = raw['shellTimeoutMs'] ?? shellRecord?.['timeoutMs'];
	const shellTimeoutMs =
		typeof rawTimeout === 'number' && Number.isFinite(rawTimeout) && rawTimeout > 0
			? rawTimeout
			: DEFAULT_COMPOSER_CONFIG.shellTimeoutMs;
	if (
		rawTimeout !== undefined &&
		shellTimeoutMs === DEFAULT_COMPOSER_CONFIG.shellTimeoutMs &&
		rawTimeout !== DEFAULT_COMPOSER_CONFIG.shellTimeoutMs
	) {
		warnings.push(
			`${sourceLabel}: shell timeout must be a positive number, using ${DEFAULT_COMPOSER_CONFIG.shellTimeoutMs}`,
		);
	}
	return {
		shellMode: shellMode ?? DEFAULT_COMPOSER_CONFIG.shellMode,
		shellTimeoutMs,
	};
}

function readComposerConfigFile(filePath: string, warnings: string[]): ComposerConfig | undefined {
	if (!existsSync(filePath)) return undefined;
	try {
		return normalizeComposerConfig(JSON.parse(readFileSync(filePath, 'utf8')), warnings, filePath);
	} catch (error) {
		warnings.push(
			`${filePath}: failed to read config (${error instanceof Error ? error.message : String(error)}), using defaults`,
		);
		return undefined;
	}
}

export function loadComposerConfig(cwd: string, warnings: string[] = []): ComposerConfig {
	const userConfig = readComposerConfigFile(join(getAgentDir(), 'prompt-composer.json'), warnings);
	const projectConfig = readComposerConfigFile(join(cwd, '.pi', 'prompt-composer.json'), warnings);
	return projectConfig ?? userConfig ?? DEFAULT_COMPOSER_CONFIG;
}

function parseShellMode(fm: Record<string, unknown>, filePath: string, warnings: string[]): ShellMode {
	const raw = fm['shell'];
	const parsed = parseShellModeValue(raw);
	if (parsed !== undefined) return parsed;
	if (raw !== undefined)
		warnings.push(
			`${basename(filePath)}: unknown shell mode "${stringifyScalar(raw)}", using configured default ${activeComposerConfig.shellMode}`,
		);
	return activeComposerConfig.shellMode;
}

function isComposerStyleFrontmatter(fm: Record<string, unknown>): boolean {
	return (
		fm['engine'] !== undefined ||
		fm['shell'] !== undefined ||
		fm['enabled'] !== undefined ||
		fm['dispatch'] !== undefined ||
		fm['type'] === 'prompt'
	);
}

/**
 * Load a single grouped prompt directory and return an EffectivePromptGroup,
 * or undefined if the directory is not a valid group.
 */
export function loadSingleGroup(
	dirPath: string,
	groupName: string,
	origin: PromptOrigin,
	warnings: string[],
): EffectivePromptGroup | undefined {
	const indexPath = join(dirPath, '_index.md');

	// Location-based ownership: any _index.md under a composer-owned root marks a group.
	if (!existsSync(indexPath)) return undefined;

	let indexContent: string;
	try {
		indexContent = readFileSync(indexPath, 'utf-8');
	} catch {
		return undefined;
	}

	const indexFm = safeParseFrontmatter(indexContent, `Group "${groupName}": _index.md`, warnings);
	if (!indexFm) {
		return undefined;
	}

	// Custom subcommand order (optional)
	const rawOrder = indexFm['order'];
	let order: string[] | undefined;
	if (rawOrder !== undefined && rawOrder !== null) {
		if (Array.isArray(rawOrder)) {
			order = rawOrder.filter((item): item is string => {
				if (typeof item !== 'string') {
					warnings.push(`Group "${groupName}": order contains non-string entry, ignoring`);
					return false;
				}
				return true;
			});
		} else {
			warnings.push(`Group "${groupName}": order must be an array, ignoring`);
		}
	}

	// Group description (recommended, warn + fallback)
	const groupDesc = fmString(indexFm, 'description');
	if (groupDesc === '') {
		warnings.push(`Group "${groupName}": _index.md missing description, using directory name as fallback`);
	}
	const effectiveGroupDesc = groupDesc === '' ? groupName : groupDesc;

	// Discover nested prompts
	const promptsByName = new Map<string, NestedPrompt>();
	let fileNames: string[];
	try {
		fileNames = readdirSync(dirPath, { encoding: 'utf-8' });
	} catch {
		return undefined;
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

		const fm = safeParseFrontmatter(rawContent, `Group "${groupName}": ${fileName}`, warnings);
		if (!fm) continue;
		const body = stripFrontmatter(rawContent);

		// Name: optional override, otherwise kebab-case filename stem
		const nameOverride = fmString(fm, 'name');
		const stem = fileName.replace(/\.md$/i, '');
		const effectiveName = nameOverride === '' ? toKebabCase(stem) : nameOverride;

		// Description (recommended, warn + fallback)
		const desc = fmString(fm, 'description');
		if (desc === '') {
			warnings.push(`Group "${groupName}": ${fileName} missing description, using filename stem as fallback`);
		}
		const effectiveDesc = desc === '' ? stem : desc;

		// Args (optional)
		const args = parseArgsMetadata(fm['args'], filePath, warnings);
		const variables = parseVariablesMetadata(fm['variables'], filePath, warnings);
		const engine = parseTemplateEngine(fm, filePath, warnings);
		const shell = parseShellMode(fm, filePath, warnings);

		const prompt: NestedPrompt = {
			name: effectiveName,
			filePath,
			description: effectiveDesc,
			args,
			variables,
			content: body,
			origin,
			groupName,
			engine,
			shell,
		};

		promptsByName.set(effectiveName, prompt);
	}

	// Skip groups with no runnable nested prompts
	if (promptsByName.size === 0) return undefined;

	// Build ordered name list: explicit order first, then remaining alphabetically
	const allNames = new Set(promptsByName.keys());
	const orderedNames: string[] = [];

	if (order) {
		for (const name of order) {
			if (allNames.has(name)) {
				orderedNames.push(name);
				allNames.delete(name);
			} else {
				warnings.push(`Group "${groupName}": order lists unknown subcommand "${name}", ignoring`);
			}
		}
	}
	// Append remaining (unlisted) names alphabetically
	for (const name of [...allNames].sort()) {
		orderedNames.push(name);
	}

	return {
		name: groupName,
		origin,
		directoryPath: dirPath,
		description: effectiveGroupDesc,
		promptsByName,
		promptNames: orderedNames,
	};
}

/**
 * Discover grouped prompt directories from an ordered list of roots.
 *
 * Each root is handled as one of two cases:
 *   Case A — the root itself is a grouped prompt directory (has _index.md with type: group).
 *            The directory name becomes the group name.
 *   Case B — the root is a parent directory whose child directories are scanned.
 */
export function discoverGroups(roots: PromptRoot[], warnings: string[]): EffectivePromptGroup[] {
	const allCandidates: EffectivePromptGroup[] = [];

	for (const root of roots) {
		// Case A: root itself is an exact grouped prompt directory
		const indexPath = join(root.rootPath, '_index.md');
		if (existsSync(indexPath)) {
			const groupName = basename(root.rootPath);
			const group = loadSingleGroup(root.rootPath, groupName, root.origin, warnings);
			if (group !== undefined) {
				allCandidates.push(group);
			}
			continue; // root consumed as exact group, skip Case B
		}

		// Case B: root is a parent directory — scan child directories
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

			const group = loadSingleGroup(dirPath, entryName, root.origin, warnings);
			if (group !== undefined) {
				allCandidates.push(group);
			}
		}
	}

	// Warn on duplicate group names across origins
	const seen = new Map<string, PromptOrigin>();
	for (const group of allCandidates) {
		const prev = seen.get(group.name);
		if (prev !== undefined) {
			warnings.push(`Duplicate group name "${group.name}" found in both ${prev} and ${group.origin} origins`);
		} else {
			seen.set(group.name, group.origin);
		}
	}

	return allCandidates;
}

export function loadFlatPrompt(filePath: string, origin: PromptOrigin, warnings: string[]): FlatPrompt | undefined {
	let rawContent: string;
	try {
		rawContent = readFileSync(filePath, 'utf-8');
	} catch {
		return undefined;
	}

	const fm = safeParseFrontmatter(rawContent, `Flat prompt ${filePath}`, warnings);
	if (!fm) return undefined;
	const body = stripFrontmatter(rawContent);
	const stem = basename(filePath).replace(/\.md$/i, '');
	const nameOverride = fmString(fm, 'name');
	const name = nameOverride === '' ? toKebabCase(stem) : nameOverride;
	const description = fmString(fm, 'description');
	if (description === '') {
		warnings.push(`Flat prompt ${filePath} missing description, using filename stem as fallback`);
	}
	const args = parseArgsMetadata(fm['args'], filePath, warnings);
	const variables = parseVariablesMetadata(fm['variables'], filePath, warnings);
	const engine = parseTemplateEngine(fm, filePath, warnings);
	const shell = parseShellMode(fm, filePath, warnings);

	return {
		name,
		filePath,
		description: description === '' ? stem : description,
		args,
		variables,
		content: body,
		origin,
		engine,
		shell,
	};
}

export function discoverFlatPrompts(roots: PromptRoot[], warnings: string[]): FlatPrompt[] {
	const prompts: FlatPrompt[] = [];

	function visit(dirPath: string, origin: PromptOrigin): void {
		let entries: string[];
		try {
			entries = readdirSync(dirPath, { encoding: 'utf-8' });
		} catch {
			return;
		}

		const hasIndex = entries.includes('_index.md');
		for (const entry of entries) {
			const entryPath = join(dirPath, entry);
			let isFile = false;
			let isDirectory = false;
			try {
				const stat = statSync(entryPath);
				isFile = stat.isFile();
				isDirectory = stat.isDirectory();
			} catch {
				continue;
			}

			if (isFile && entry.endsWith('.md') && entry !== '_index.md' && !hasIndex) {
				const prompt = loadFlatPrompt(entryPath, origin, warnings);
				if (prompt) prompts.push(prompt);
			}

			if (isDirectory && !hasIndex) {
				visit(entryPath, origin);
			}
		}
	}

	for (const root of roots) {
		// Exact bundled group root is already consumed by grouped discovery.
		if (existsSync(join(root.rootPath, '_index.md'))) continue;
		visit(root.rootPath, root.origin);
	}

	const seen = new Map<string, PromptOrigin>();
	for (const prompt of prompts) {
		const prev = seen.get(prompt.name);
		if (prev !== undefined) {
			warnings.push(`Duplicate flat prompt name "${prompt.name}" found in both ${prev} and ${prompt.origin} origins`);
		} else {
			seen.set(prompt.name, prompt.origin);
		}
	}

	return prompts;
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
			const label = arg.hint !== '' ? `${arg.name} — ${arg.hint}` : arg.name;
			lines.push(`  ${marker} ${theme.fg('muted', label)}`);
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
// Rendering and interactive prompt helpers
// ---------------------------------------------------------------------------

function createPromptLiquidEngine(promptFilePath: string) {
	const promptDir = dirname(promptFilePath);
	return createEngine({
		root: [promptDir],
		partials: [join(promptDir, '_partials'), promptDir],
		layouts: [],
	});
}

function expandShellBlocks(content: string, markerId: string): string {
	let index = 0;
	return content.replace(/{%\s*shell\s*%}([\s\S]*?){%\s*endshell\s*%}/g, (_match: string, body: string) => {
		const shellIndex = index++;
		const captureName = `__composer_shell_${shellIndex}`;
		const marker = `__PI_PROMPT_COMPOSER_SHELL_${markerId}_${shellIndex}`;
		return `{% capture ${captureName} %}${body}{% endcapture %}${marker}_START__\n{{ ${captureName} | strip }}\n${marker}_END__`;
	});
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveShellBlocks(
	rendered: string,
	prompt: NestedPrompt | FlatPrompt,
	options: RenderPromptOptions | undefined,
	markerId: string,
): Promise<string> {
	const escapedMarkerId = escapeRegExp(markerId);
	const pattern = new RegExp(
		`__PI_PROMPT_COMPOSER_SHELL_${escapedMarkerId}_(\\d+)_START__\\n([\\s\\S]*?)\\n__PI_PROMPT_COMPOSER_SHELL_${escapedMarkerId}_\\1_END__`,
		'g',
	);
	let result = '';
	let lastIndex = 0;
	for (const match of rendered.matchAll(pattern)) {
		const fullMatch = match[0];
		const command = match[2]?.trim() ?? '';
		result += rendered.slice(lastIndex, match.index);
		result += await resolveShellCommand(command, prompt, options);
		lastIndex = (match.index ?? 0) + fullMatch.length;
	}
	result += rendered.slice(lastIndex);
	return result;
}

async function resolveShellCommand(
	command: string,
	prompt: NestedPrompt | FlatPrompt,
	options: RenderPromptOptions | undefined,
): Promise<string> {
	if (command === '') return '';
	const commandBlock = `\`\`\`bash\n${command}\n\`\`\``;
	if (prompt.shell === 'deny') {
		return `Shell command not executed because shell mode is deny. Add \`shell: ask\` or \`shell: allow\` to ${basename(prompt.filePath)}, or set prompt-composer config.\n\n${commandBlock}`;
	}

	if (prompt.shell === 'ask') {
		const confirmed = await options?.ctx?.ui.confirm(
			'Run prompt shell command?',
			`${command}\n\nWorking directory: ${dirname(prompt.filePath)}`,
		);
		if (confirmed !== true) return `Shell command skipped by operator.\n\n\`\`\`bash\n${command}\n\`\`\``;
	}

	if (options?.shellExecutor) {
		return options.shellExecutor(command, dirname(prompt.filePath));
	}
	if (!options?.pi) return `Shell command not executed because no shell executor is available.\n\n${commandBlock}`;

	const output = await options.pi.exec('bash', ['-lc', command], {
		cwd: dirname(prompt.filePath),
		timeout: options.shellTimeoutMs ?? activeComposerConfig.shellTimeoutMs,
	});
	if (output.code === 0) return output.stdout.trimEnd();
	const stderr = output.stderr.trimEnd();
	const stdout = output.stdout.trimEnd();
	return [`Shell command failed with exit code ${output.code}.`, stdout, stderr]
		.filter((line) => line !== '')
		.join('\n');
}

export async function renderPrompt(
	prompt: NestedPrompt | FlatPrompt,
	resolved: ResolvedPromptArgs,
	options?: RenderPromptOptions,
): Promise<string> {
	if (prompt.engine === 'pi') return substituteArgs(prompt.content, resolved.args);

	const promptMeta =
		'groupName' in prompt
			? { name: prompt.name, groupName: prompt.groupName, origin: prompt.origin, filePath: prompt.filePath }
			: { name: prompt.name, origin: prompt.origin, filePath: prompt.filePath };

	const markerId = randomUUID();
	const expandedContent = expandShellBlocks(prompt.content, markerId);
	const liquidEngine = createPromptLiquidEngine(prompt.filePath);
	const rendered = String(
		liquidEngine.renderSync(liquidEngine.parse(expandedContent, prompt.filePath), {
			args: resolved.namedArgs,
			argv: resolved.args,
			arguments: resolved.args.join(' '),
			variables: prompt.variables ?? {},
			prompt: promptMeta,
			now: new Date().toISOString(),
		}),
	);
	return resolveShellBlocks(rendered, prompt, options, markerId);
}

function commandPath(prompt: NestedPrompt | FlatPrompt): string {
	return 'groupName' in prompt ? `/${prompt.groupName} ${prompt.name}` : `/${prompt.name}`;
}

function parseArgsForPrompt(prompt: NestedPrompt | FlatPrompt, tokens: string[]): ParsedPromptArgs {
	if (prompt.engine === 'pi') return { positionals: tokens, named: {} };
	return parsePromptArgs(tokens);
}

function setNamedArg(named: Record<string, string | boolean | string[]>, key: string, value: string | boolean): void {
	const existing = named[key];
	if (existing === undefined) {
		named[key] = value;
		return;
	}
	const nextValue = typeof value === 'boolean' ? String(value) : value;
	if (Array.isArray(existing)) {
		existing.push(nextValue);
		return;
	}
	named[key] = [typeof existing === 'boolean' ? String(existing) : existing, nextValue];
}

function parsePromptArgs(tokens: string[]): ParsedPromptArgs {
	const positionals: string[] = [];
	const named: Record<string, string | boolean | string[]> = {};

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (token === undefined) continue;

		if (token.startsWith('--') && token.length > 2) {
			const key = token.slice(2);
			const next = tokens[index + 1];
			if (next === undefined || next.startsWith('--')) {
				setNamedArg(named, key, true);
				continue;
			}
			setNamedArg(named, key, next);
			index++;
			continue;
		}

		const equalsIndex = token.indexOf('=');
		if (equalsIndex > 0) {
			const key = token.slice(0, equalsIndex);
			const value = token.slice(equalsIndex + 1);
			setNamedArg(named, key, value);
			continue;
		}

		positionals.push(token);
	}

	return { positionals, named };
}

function coerceArgValue(arg: ArgsItem, rawValue: unknown, ctx: ExtensionCommandContext): unknown {
	if (rawValue === undefined || rawValue === '') return rawValue;
	const type = arg.type ?? 'string';

	if (type === 'string') return stringifyScalar(rawValue);
	if (type === 'string[]') {
		if (Array.isArray(rawValue)) return rawValue.map((value) => stringifyScalar(value));
		return stringifyScalar(rawValue)
			.split(',')
			.map((value) => value.trim())
			.filter((value) => value !== '');
	}
	if (type === 'boolean') {
		if (typeof rawValue === 'boolean') return rawValue;
		const normalized = stringifyScalar(rawValue).toLowerCase();
		if (normalized === 'true' || normalized === 'yes' || normalized === '1') return true;
		if (normalized === 'false' || normalized === 'no' || normalized === '0') return false;
		ctx.ui.notify(`Argument "${arg.name}" must be boolean`, 'warning');
		return undefined;
	}
	if (type === 'number') {
		const value = Number(rawValue);
		if (Number.isFinite(value)) return value;
		ctx.ui.notify(`Argument "${arg.name}" must be a number`, 'warning');
		return undefined;
	}
	if (type === 'enum') {
		const value = stringifyScalar(rawValue);
		if (!arg.values || arg.values.length === 0 || arg.values.includes(value)) return value;
		ctx.ui.notify(`Argument "${arg.name}" must be one of: ${arg.values.join(', ')}`, 'warning');
		return undefined;
	}
	return rawValue;
}

function isMissingArgValue(value: unknown): boolean {
	return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

async function resolvePromptArgs(
	prompt: NestedPrompt | FlatPrompt,
	providedArgs: ParsedPromptArgs,
	ctx: ExtensionCommandContext,
): Promise<ResolvedPromptArgs | undefined> {
	const resolvedArgs = [...providedArgs.positionals];
	const namedArgs: Record<string, unknown> = { ...providedArgs.named };
	let didCollectMissingArgs = false;

	for (const [index, arg] of (prompt.args ?? []).entries()) {
		const restValues = resolvedArgs.slice(index);
		let rawValue: unknown =
			arg.rest === true
				? (namedArgs[arg.name] ?? (restValues.length > 0 ? restValues : arg.defaultValue))
				: (namedArgs[arg.name] ?? resolvedArgs[index] ?? arg.defaultValue);

		if (isMissingArgValue(rawValue) && arg.required) {
			let value: string | undefined;
			do {
				value = await ctx.ui.input(`${commandPath(prompt)} — ${arg.name}`, arg.hint !== '' ? arg.hint : undefined);
				if (value === undefined) return undefined;
				if (value.trim() === '') {
					ctx.ui.notify(`Argument "${arg.name}" is required`, 'warning');
				}
			} while (value.trim() === '');
			rawValue = value;
			resolvedArgs[index] = value;
			didCollectMissingArgs = true;
		} else if (rawValue === undefined && !arg.required) {
			// Preserve current behavior: optional declared args are offered interactively.
			const value = await ctx.ui.input(
				`${commandPath(prompt)} — ${arg.name} (optional)`,
				arg.hint !== '' ? arg.hint : 'enter to skip',
			);
			if (value === undefined) return undefined;
			rawValue = value;
			resolvedArgs[index] = value;
			if (value.trim() !== '') didCollectMissingArgs = true;
		}

		const coerced = coerceArgValue(arg, rawValue, ctx);
		if (coerced === undefined && (arg.required || !isMissingArgValue(rawValue))) return undefined;
		if (coerced !== undefined && coerced !== '') {
			namedArgs[arg.name] = coerced;
			if (arg.rest === true && Array.isArray(coerced)) {
				resolvedArgs.splice(index, coerced.length, ...coerced.map((value) => stringifyScalar(value)));
			}
		}
	}

	return { args: resolvedArgs, namedArgs, didCollectMissingArgs };
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
	/** Warnings from the most recent discovery pass, surfaced on session_start. */
	let lastWarnings: string[] = [];

	function registerGroupedCommands() {
		const warnings: string[] = [];
		activeComposerConfig = loadComposerConfig(process.cwd(), warnings);
		const roots = getPromptRoots(warnings);
		const groups = discoverGroups(roots, warnings);
		const flatPrompts = discoverFlatPrompts(roots, warnings);
		lastWarnings = warnings;

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
					// Re-check required tools on every command invocation — by now all
					// session_start handlers have completed, so this catches the ordering
					// race and any mid-session tool state changes.
					checkRequiredTools(pi, ctx);

					const trimmed = argsString.trim();

					// Bare /group -> rich selector flow
					if (trimmed === '') {
						const selectedName = await showPromptSelector(group, ctx);
						if (selectedName === undefined) return;

						const prompt = group.promptsByName.get(selectedName);
						if (prompt === undefined) return;

						const resolved = await resolvePromptArgs(prompt, { positionals: [], named: {} }, ctx);
						if (resolved === undefined) return;

						const rendered = await renderPrompt(prompt, resolved, {
							pi,
							ctx,
							shellTimeoutMs: activeComposerConfig.shellTimeoutMs,
						});
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

					const promptArgs = parseArgsForPrompt(prompt, parsed.slice(1));
					const resolved = await resolvePromptArgs(prompt, promptArgs, ctx);
					if (resolved === undefined) return;

					const rendered = await renderPrompt(prompt, resolved, {
						pi,
						ctx,
						shellTimeoutMs: activeComposerConfig.shellTimeoutMs,
					});
					pi.sendUserMessage(rendered, {
						deliverAs: 'followUp',
					});
				},
			});
		}

		for (const prompt of flatPrompts) {
			pi.registerCommand(prompt.name, {
				description: prompt.description,
				async handler(argsString, ctx) {
					checkRequiredTools(pi, ctx);
					const parsed = parseArgsForPrompt(prompt, parseCommandArgs(argsString.trim()));
					const resolved = await resolvePromptArgs(prompt, parsed, ctx);
					if (resolved === undefined) return;
					const rendered = await renderPrompt(prompt, resolved, {
						pi,
						ctx,
						shellTimeoutMs: activeComposerConfig.shellTimeoutMs,
					});
					pi.sendUserMessage(rendered, {
						deliverAs: 'followUp',
					});
				},
			});
		}
	}

	// Initial discovery on extension load
	registerGroupedCommands();

	// --- Required-tool guard --------------------------------------------------
	// Check on session lifecycle events + before our own command dispatch.
	// No per-turn overhead — the command handler check catches the ordering
	// race where other session_start handlers haven't restored state yet.
	pi.on('session_start', async (_event, ctx) => {
		for (const w of lastWarnings) {
			ctx.ui.notify(`[prompt-composer] ${w}`, 'warning');
		}
		checkRequiredTools(pi, ctx);
	});
	pi.on('session_tree', async (_event, ctx) => {
		checkRequiredTools(pi, ctx);
	});
}
