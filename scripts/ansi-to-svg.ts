/**
 * Minimal ANSI-to-SVG converter that supports truecolor (38;2;R;G;B).
 *
 * ansi-to-svg doesn't handle truecolor sequences, so we roll our own
 * lightweight parser that handles exactly what Pi's Theme.fg() emits.
 */

interface Span {
	text: string;
	color: string | null;
}

/** Parse ANSI escape sequences into colored spans. */
function parseAnsi(input: string): Span[] {
	const spans: Span[] = [];
	let currentColor: string | null = null;

	// Match ANSI CSI sequences: ESC[ ... m
	// eslint-disable-next-line no-control-regex -- intentional ANSI escape matching
	const regex = /\x1b\[([0-9;]*)m/g;
	let lastIndex = 0;

	for (const match of input.matchAll(regex)) {
		// Text before this escape
		if (match.index > lastIndex) {
			const text = input.slice(lastIndex, match.index);
			if (text.length > 0) {
				spans.push({ text, color: currentColor });
			}
		}
		lastIndex = match.index + match[0].length;

		const codes = match[1].split(';').map(Number);

		// Parse SGR codes
		let i = 0;
		while (i < codes.length) {
			const code = codes[i];
			if (code === 0 || code === 39) {
				// Reset or default foreground
				currentColor = null;
				i++;
			} else if (code === 38 && codes[i + 1] === 2) {
				// Truecolor: 38;2;R;G;B
				const r = codes[i + 2] ?? 0;
				const g = codes[i + 3] ?? 0;
				const b = codes[i + 4] ?? 0;
				currentColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
				i += 5;
			} else if (code === 1) {
				// Bold — ignore for now (SVG font-weight could be used)
				i++;
			} else {
				i++;
			}
		}
	}

	// Remaining text after last escape
	if (lastIndex < input.length) {
		spans.push({ text: input.slice(lastIndex), color: currentColor });
	}

	return spans;
}

/** Escape text for XML/SVG. */
function escapeXml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface AnsiToSvgOptions {
	/** Font family */
	fontFamily?: string;
	/** Font size in px */
	fontSize?: number;
	/** Character width in px (monospace) */
	charWidth?: number;
	/** Line height in px */
	lineHeight?: number;
	/** Padding around content */
	padding?: number;
	/** Background color */
	backgroundColor?: string;
	/** Default text color */
	defaultColor?: string;
}

/** Convert ANSI-escaped text lines to an SVG string. */
export function renderSvg(lines: string[], options: AnsiToSvgOptions = {}): string {
	const {
		fontFamily = "'SauceCodePro Nerd Font', 'Source Code Pro', 'Courier New', monospace",
		fontSize = 14,
		charWidth = 8.4,
		lineHeight = 20,
		padding = 16,
		backgroundColor = '#1F1F28',
		defaultColor = '#DCD7BA',
	} = options;

	const maxCols = Math.max(...lines.map((l) => {
		// Strip ANSI to count visible chars
		// eslint-disable-next-line no-control-regex -- intentional ANSI escape stripping
		const stripped = l.replace(/\x1b\[[0-9;]*m/g, '');
		return stripped.length;
	}));

	const width = maxCols * charWidth + padding * 2;
	const height = lines.length * lineHeight + padding * 2;

	const svgLines: string[] = [];
	svgLines.push(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" font-family="${fontFamily}" font-size="${fontSize}">`,
	);
	svgLines.push(`<rect width="100%" height="100%" fill="${backgroundColor}"/>`);

	for (let row = 0; row < lines.length; row++) {
		const spans = parseAnsi(lines[row]);
		const y = padding + (row + 1) * lineHeight - lineHeight * 0.3;
		let x = padding;

		for (const span of spans) {
			if (span.text.length === 0) continue;
			const fill = span.color ?? defaultColor;
			svgLines.push(
				`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${fill}">${escapeXml(span.text)}</text>`,
			);
			x += span.text.length * charWidth;
		}
	}

	svgLines.push('</svg>');
	return svgLines.join('\n');
}
