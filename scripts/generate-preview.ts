#!/usr/bin/env bun
/**
 * Render the grouped-prompt selector as raw ANSI text.
 *
 * Loads the operator's real Pi config (theme, settings) — same as Pi itself.
 * Outputs raw control sequences to stdout. Pipe through `freeze` for an image:
 *
 *   bun scripts/generate-preview.ts | freeze --output assets/preview.png
 *   bun scripts/generate-preview.ts --width 90 | freeze -o assets/preview.svg
 */

import { DynamicBorder, SettingsManager } from '@mariozechner/pi-coding-agent';
import { Container, type SelectItem, SelectList, type SelectListTheme, Spacer, Text, type Terminal, TUI } from '@mariozechner/pi-tui';

// Direct filesystem import: the global `theme` singleton isn't re-exported
// from the package root, but it's the same object all Pi components use.
const themeMod = await import(
	'../node_modules/@mariozechner/pi-coding-agent/dist/modes/interactive/theme/theme.js'
);

// ---------------------------------------------------------------------------
// Load the operator's real Pi config — same path Pi itself takes
// ---------------------------------------------------------------------------

const settings = SettingsManager.create(process.cwd());
const themeName = settings.getTheme();
themeMod.initTheme(themeName);
const theme = themeMod.theme;

// ---------------------------------------------------------------------------
// Example data
// ---------------------------------------------------------------------------

const GROUP = {
	name: 'review',
	description: 'Review workflows',
	prompts: [
		{
			name: 'fix',
			description: 'Suggest a targeted fix',
			args: '<issue>',
			argHints: [{ name: 'issue', hint: 'What issue should be fixed?' }],
		},
		{
			name: 'summary',
			description: 'Summarize a change',
			args: '<change> [context]',
			argHints: [
				{ name: 'change', hint: 'What changed?' },
				{ name: 'context', hint: 'Additional context' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Headless terminal (render only, no I/O)
// ---------------------------------------------------------------------------

class HeadlessTerminal implements Terminal {
	constructor(
		private _columns: number,
		private _rows: number,
	) {}
	start(): void {}
	stop(): void {}
	async drainInput(): Promise<void> {}
	write(): void {}
	get columns(): number {
		return this._columns;
	}
	get rows(): number {
		return this._rows;
	}
	get kittyProtocolActive(): boolean {
		return false;
	}
	moveBy(): void {}
	hideCursor(): void {}
	showCursor(): void {}
	clearLine(): void {}
	clearFromCursor(): void {}
	clearScreen(): void {}
	setTitle(): void {}
}

// ---------------------------------------------------------------------------
// Build selector (matches real GroupSelectorComponent from extensions/index.ts)
// ---------------------------------------------------------------------------

function buildComponent(): Container {
	const slTheme: SelectListTheme = {
		selectedPrefix: (t: string) => theme.fg('accent', t),
		selectedText: (t: string) => theme.fg('accent', t),
		description: (t: string) => theme.fg('muted', t),
		scrollInfo: (t: string) => theme.fg('muted', t),
		noMatch: (t: string) => theme.fg('muted', t),
	};

	const items: SelectItem[] = GROUP.prompts.map((p) => ({
		value: p.name,
		label: p.name,
		description: p.description,
	}));

	const container = new Container();

	container.addChild(new DynamicBorder((s: string) => theme.fg('border', s)));
	container.addChild(new Spacer(1));
	container.addChild(new Text(theme.fg('accent', GROUP.description), 1, 0));
	container.addChild(new Spacer(1));

	const selectList = new SelectList(items, items.length, slTheme, {
		minPrimaryColumnWidth: 10,
		maxPrimaryColumnWidth: 24,
	});
	container.addChild(selectList);

	container.addChild(new Spacer(1));
	const p = GROUP.prompts[0];
	const usage = `  ${theme.fg('dim', `/${GROUP.name} ${p.name}`)} ${theme.fg('accent', p.args)}`;
	const hints = p.argHints.map(
		(a) => `  ${theme.fg('accent', '•')} ${theme.fg('muted', `${a.name} — ${a.hint}`)}`,
	);
	container.addChild(new Text([usage, ...hints].join('\n'), 1, 0));

	container.addChild(new Spacer(1));
	const kb = [
		`${theme.fg('dim', '↑↓')} ${theme.fg('muted', 'navigate')}`,
		`${theme.fg('dim', 'enter')} ${theme.fg('muted', 'select')}`,
		`${theme.fg('dim', 'esc')} ${theme.fg('muted', 'cancel')}`,
	].join('   ');
	container.addChild(new Text(kb, 1, 0));
	container.addChild(new Spacer(1));
	container.addChild(new DynamicBorder((s: string) => theme.fg('border', s)));

	return container;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let width = 80;
for (let i = 2; i < process.argv.length; i++) {
	if (process.argv[i] === '--width' && process.argv[i + 1]) {
		width = Number.parseInt(process.argv[i + 1], 10);
		i++;
	}
}

new TUI(new HeadlessTerminal(width, 30));
const lines = buildComponent().render(width);

process.stdout.write(`${lines.join('\n')}\n`);
