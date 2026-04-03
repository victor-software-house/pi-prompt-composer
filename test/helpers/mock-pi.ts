/**
 * Shared mock infrastructure for extension tests.
 *
 * Provides a mock ExtensionAPI, command context, theme, and selector helpers
 * used across all test layers.
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisteredCommand {
	description: string;
	handler: (argsString: string, ctx: MockCommandContext) => Promise<void>;
	getArgumentCompletions?: (prefix: string) => unknown;
}

export interface MockCommandContext {
	ui: {
		select: (title: string, options: string[]) => Promise<string | undefined>;
		input: (title: string, placeholder?: string) => Promise<string | undefined>;
		editor: (title: string, prefill?: string) => Promise<string | undefined>;
		notify: (message: string, severity: string) => void;
		setWidget: (key: string, factory: WidgetFactory) => void;
		custom: <T>(
			factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => unknown,
		) => Promise<T>;
	};
}

export interface SendUserMessageCall {
	content: string;
	options: Record<string, unknown> | undefined;
}

export type SessionHandler = (event: unknown, ctx: unknown) => Promise<void>;
export type WidgetFactory = ((tui: unknown, theme: unknown) => unknown) | undefined;

// ---------------------------------------------------------------------------
// Mock theme — returns text unmodified (no ANSI escapes in tests)
// ---------------------------------------------------------------------------

export const mockTheme = {
	fg: (_color: string, text: string) => text,
};

// ---------------------------------------------------------------------------
// Mock ExtensionAPI factory
// ---------------------------------------------------------------------------

export interface MockPiOptions {
	/** Tools returned by getAllTools(). Defaults to [{ name: 'ask_user' }]. */
	allTools?: Array<{ name: string }>;
	/** Tool names returned by getActiveTools(). Defaults to ['ask_user']. */
	activeTools?: string[];
}

export function createMockPi(opts: MockPiOptions = {}) {
	const commands = new Map<string, RegisteredCommand>();
	const sentMessages: SendUserMessageCall[] = [];
	const eventHandlers = new Map<string, SessionHandler>();
	const widgets = new Map<string, WidgetFactory>();

	const allTools = (opts.allTools ?? [{ name: 'ask_user' }]).map((t) => ({
		name: t.name,
		description: '',
		parameters: {},
		sourceInfo: { source: 'test', path: '' },
	}));
	const activeTools = opts.activeTools ?? ['ask_user'];

	const mockPi = {
		registerCommand(name: string, cmd: RegisteredCommand) {
			commands.set(name, cmd);
		},
		sendUserMessage(content: string, options?: Record<string, unknown>) {
			sentMessages.push({ content, options: options ?? undefined });
		},
		on(event: string, handler: SessionHandler) {
			eventHandlers.set(event, handler);
		},
		getAllTools: () => allTools,
		getActiveTools: () => activeTools,
	};

	return { mockPi: mockPi as unknown as ExtensionAPI, commands, sentMessages, eventHandlers, widgets };
}

// ---------------------------------------------------------------------------
// Extension loader
// ---------------------------------------------------------------------------

export async function loadExtension(mockPi: ExtensionAPI, cwd: string) {
	const originalCwd = process.cwd();
	process.chdir(cwd);
	try {
		const mod = await import('../../extensions/index');
		mod.default(mockPi);
	} finally {
		process.chdir(originalCwd);
	}
}

// ---------------------------------------------------------------------------
// Command context factory
// ---------------------------------------------------------------------------

export function createContext(overrides?: {
	input?: MockCommandContext['ui']['input'];
	custom?: MockCommandContext['ui']['custom'];
}) {
	const notifyCalls: Array<{ message: string; severity: string }> = [];
	const inputCalls: Array<{ title: string; placeholder: string | undefined }> = [];
	const widgetCalls: Array<{ key: string; factory: WidgetFactory }> = [];

	const ctx: MockCommandContext = {
		ui: {
			select: async () => undefined,
			input: overrides?.input ?? (async () => ''),
			editor: async (_title, prefill) => prefill,
			notify: (message, severity) => {
				notifyCalls.push({ message, severity });
			},
			setWidget(_key: string, _factory: WidgetFactory) {},
			custom: overrides?.custom ?? (async () => undefined as never),
		},
	};

	const originalInput = ctx.ui.input;
	ctx.ui.input = async (title, placeholder) => {
		inputCalls.push({ title, placeholder });
		return originalInput(title, placeholder);
	};

	return { ctx, notifyCalls, inputCalls, widgetCalls };
}

// ---------------------------------------------------------------------------
// Selector mock helpers
// ---------------------------------------------------------------------------

/** Mock custom() that selects a specific subcommand. */
export function makeSelectorCustomMock(selectValue: string) {
	return async <T>(
		factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => unknown,
	): Promise<T> => {
		return new Promise<T>((resolve) => {
			const component = factory(null, mockTheme, null, resolve) as {
				children?: Array<{ onSelect?: (item: { value: string }) => void }>;
			};
			if (component.children) {
				for (const child of component.children) {
					if (typeof child.onSelect === 'function') {
						child.onSelect({ value: selectValue });
						return;
					}
				}
			}
			resolve(undefined as T);
		});
	};
}

/** Mock custom() that simulates pressing cancel. */
export function makeCancelCustomMock() {
	return async <T>(
		factory: (tui: unknown, theme: unknown, keybindings: unknown, done: (result: T) => void) => unknown,
	): Promise<T> => {
		return new Promise<T>((resolve) => {
			const component = factory(null, mockTheme, null, resolve) as {
				children?: Array<{ onCancel?: () => void }>;
			};
			if (component.children) {
				for (const child of component.children) {
					if (typeof child.onCancel === 'function') {
						child.onCancel();
						return;
					}
				}
			}
			resolve(undefined as T);
		});
	};
}

// ---------------------------------------------------------------------------
// Widget rendering helper
// ---------------------------------------------------------------------------

/** Render a widget factory and extract the joined text from Text children. */
export function renderWidgetText(factory: WidgetFactory): string {
	if (!factory) return '';
	const component = factory(null, mockTheme) as {
		children?: Array<{ text?: string }>;
	};
	if (!component.children) return '';
	return component.children
		.filter((c): c is { text: string } => typeof c?.text === 'string')
		.map((c) => c.text)
		.join(' ');
}

/** Mock session context with setWidget tracking. */
export function createSessionContext() {
	let lastWidgetFactory: WidgetFactory = undefined;
	const notifyCalls: Array<{ message: string; severity: string }> = [];

	const ctx = {
		ui: {
			notify(message: string, severity: string) {
				notifyCalls.push({ message, severity });
			},
			setWidget(_key: string, factory: WidgetFactory) {
				lastWidgetFactory = factory;
			},
			theme: mockTheme,
		},
	};

	return { ctx, notifyCalls, getWidgetFactory: () => lastWidgetFactory };
}
