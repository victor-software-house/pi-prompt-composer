#!/usr/bin/env bun
/**
 * Generate a preview image of the grouped-prompt selector.
 *
 * Renders the GroupSelectorComponent headlessly with Pi theme colors,
 * captures ANSI output, and converts to SVG with truecolor support.
 *
 * Usage:
 *   bun scripts/generate-preview.ts [--width 80] [--output assets/preview.svg]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { DynamicBorder, Theme } from '@mariozechner/pi-coding-agent';
import { Container, type SelectItem, SelectList, type SelectListTheme, Spacer, Text, type Terminal, TUI } from '@mariozechner/pi-tui';

import { renderSvg } from './ansi-to-svg';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 80;
const DEFAULT_OUTPUT = 'assets/preview.svg';

// Example prompts for the preview
const EXAMPLE_GROUP = {
	name: 'review',
	description: 'Review workflows',
	prompts: [
		{ name: 'fix', description: 'Suggest a targeted fix', args: '<issue>', argHints: [{ name: 'issue', hint: 'What issue should be fixed?' }] },
		{ name: 'summary', description: 'Summarize a change', args: '<change> [context]', argHints: [{ name: 'change', hint: 'What changed?' }, { name: 'context', hint: 'Additional context' }] },
	],
};

// ---------------------------------------------------------------------------
// Kanagawa dark theme (Pi default)
// ---------------------------------------------------------------------------

const KANAGAWA_FG = {
	accent: '#DCA561', border: '#54546D', borderAccent: '#DCA561', borderMuted: '#363646',
	success: '#76946A', error: '#C34043', warning: '#DCA561', muted: '#727169', dim: '#54546D',
	text: '#DCD7BA', thinkingText: '#727169', userMessageText: '#DCD7BA', customMessageText: '#DCD7BA',
	customMessageLabel: '#DCA561', toolTitle: '#7E9CD8', toolOutput: '#DCD7BA',
	mdHeading: '#DCA561', mdLink: '#7E9CD8', mdLinkUrl: '#54546D', mdCode: '#957FB8',
	mdCodeBlock: '#DCD7BA', mdCodeBlockBorder: '#363646', mdQuote: '#727169', mdQuoteBorder: '#54546D',
	mdHr: '#54546D', mdListBullet: '#DCA561', toolDiffAdded: '#76946A', toolDiffRemoved: '#C34043',
	toolDiffContext: '#727169', syntaxComment: '#727169', syntaxKeyword: '#957FB8',
	syntaxFunction: '#7E9CD8', syntaxVariable: '#DCD7BA', syntaxString: '#98BB6C',
	syntaxNumber: '#D27E99', syntaxType: '#7AA89F', syntaxOperator: '#C0A36E',
	syntaxPunctuation: '#9A9A82', thinkingOff: '#54546D', thinkingMinimal: '#54546D',
	thinkingLow: '#76946A', thinkingMedium: '#DCA561', thinkingHigh: '#FF9E3B',
	thinkingXhigh: '#C34043', bashMode: '#957FB8',
} as const;

const KANAGAWA_BG = {
	selectedBg: '#2A2A37', userMessageBg: '#2A2A37', customMessageBg: '#2A2A37',
	toolPendingBg: '#1F1F28', toolSuccessBg: '#1F1F28', toolErrorBg: '#2A2020',
} as const;

const KANAGAWA_BACKGROUND = '#1F1F28';

// ---------------------------------------------------------------------------
// Headless terminal
// ---------------------------------------------------------------------------

class HeadlessTerminal implements Terminal {
	private _columns: number;
	private _rows: number;

	constructor(columns: number, rows: number) {
		this._columns = columns;
		this._rows = rows;
	}

	start(): void {}
	stop(): void {}
	async drainInput(): Promise<void> {}
	write(): void {}
	get columns(): number { return this._columns; }
	get rows(): number { return this._rows; }
	get kittyProtocolActive(): boolean { return false; }
	moveBy(): void {}
	hideCursor(): void {}
	showCursor(): void {}
	clearLine(): void {}
	clearFromCursor(): void {}
	clearScreen(): void {}
	setTitle(): void {}
}

// ---------------------------------------------------------------------------
// Build selector component
// ---------------------------------------------------------------------------

function buildSelectListTheme(theme: Theme): SelectListTheme {
	return {
		selectedPrefix: (text: string) => theme.fg('accent', text),
		selectedText: (text: string) => theme.fg('accent', text),
		description: (text: string) => theme.fg('muted', text),
		scrollInfo: (text: string) => theme.fg('muted', text),
		noMatch: (text: string) => theme.fg('muted', text),
	};
}

function buildPreviewComponent(theme: Theme): Container {
	const container = new Container();

	const items: SelectItem[] = EXAMPLE_GROUP.prompts.map((p) => ({
		value: p.name,
		label: p.name,
		description: p.description,
	}));

	// Top border
	container.addChild(new DynamicBorder((s: string) => theme.fg('border', s)));
	container.addChild(new Spacer(1));

	// Title
	container.addChild(new Text(theme.fg('accent', EXAMPLE_GROUP.description), 1, 0));
	container.addChild(new Spacer(1));

	// Select list
	const selectList = new SelectList(items, items.length, buildSelectListTheme(theme), {
		minPrimaryColumnWidth: 10,
		maxPrimaryColumnWidth: 24,
	});
	container.addChild(selectList);

	// Usage hint for first (selected) item
	container.addChild(new Spacer(1));
	const p = EXAMPLE_GROUP.prompts[0];
	const usageLine = `  ${theme.fg('dim', `/${EXAMPLE_GROUP.name} ${p.name}`)} ${theme.fg('accent', p.args)}`;
	const hintLines = p.argHints.map((a) => `  ${theme.fg('accent', '•')} ${theme.fg('muted', `${a.name} — ${a.hint}`)}`);
	container.addChild(new Text([usageLine, ...hintLines].join('\n'), 1, 0));

	// Keyboard hints
	container.addChild(new Spacer(1));
	const hints = [
		`${theme.fg('dim', '↑↓')} ${theme.fg('muted', 'navigate')}`,
		`${theme.fg('dim', 'enter')} ${theme.fg('muted', 'select')}`,
		`${theme.fg('dim', 'esc')} ${theme.fg('muted', 'cancel')}`,
	].join('   ');
	container.addChild(new Text(hints, 1, 0));
	container.addChild(new Spacer(1));

	// Bottom border
	container.addChild(new DynamicBorder((s: string) => theme.fg('border', s)));

	return container;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(): { width: number; output: string } {
	const args = process.argv.slice(2);
	let width = DEFAULT_WIDTH;
	let output = DEFAULT_OUTPUT;

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--width' && args[i + 1]) {
			width = Number.parseInt(args[i + 1], 10);
			i++;
		} else if (args[i] === '--output' && args[i + 1]) {
			output = args[i + 1]!;
			i++;
		}
	}

	return { width, output };
}

function main() {
	const { width, output } = parseArgs();

	const theme = new Theme(KANAGAWA_FG, KANAGAWA_BG, 'truecolor');

	const terminal = new HeadlessTerminal(width, 30);
	new TUI(terminal);
	const component = buildPreviewComponent(theme);

	const lines = component.render(width);

	const svg = renderSvg(lines, {
		backgroundColor: KANAGAWA_BACKGROUND,
		defaultColor: KANAGAWA_FG.text,
	});

	mkdirSync(dirname(output), { recursive: true });
	writeFileSync(output, svg, 'utf-8');
	console.log(`Preview written to ${output} (${width} cols, ${lines.length} lines, ${svg.length} bytes)`);
}

main();
