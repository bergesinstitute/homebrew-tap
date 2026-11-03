/**
 * Rounded borders, in each block's own colour and with no background fill,
 * for the transcript blocks: tool executions, the user's prompt, and the
 * system blocks (custom, compaction, branch and skill messages).
 *
 * pi fills tool blocks with a background colour (grey while running, green on
 * success, red on failure), the user's prompt with blue, and the system
 * blocks with grey. The theme JSON has no border keys, so the borders are
 * drawn here:
 *
 * - Tool blocks go through `registerToolRenderer`: every tool is switched to
 *   the "self" shell, where the renderer draws its own framing instead of
 *   pi's filled Box. The call and the result are separate children in that
 *   shell, so one box per tool row is kept in the renderer state: the call
 *   renderer fills it, the result renderer appends to it and returns an empty
 *   component, so the border is drawn once.
 * - The user's prompt has no renderer hook, so `UserMessageComponent.rebuild`
 *   is patched to swap the Markdown it builds into the same kind of box. The
 *   class is exported and extensions share module instances with pi, so the
 *   patch reaches the components pi itself builds.
 * - The system blocks are Boxes filled with `customMessageBg`. Their `render`
 *   is replaced with the same border in muted, the colour their text already
 *   uses; the label inside keeps the brand red.
 *
 * Every box is inset by outputPad, so its border lines up with regular text,
 * and its content sits flush against the border (PAD_Y is 0).
 *
 * One spacing fix lives here too. With thinking blocks hidden, pi renders the
 * blanked label (`setHiddenThinkingLabel("")` in berges.ts) as a line of
 * escape codes with no text, and groups a spacer around it, so the first
 * block of every turn sat three blank lines below the prompt. The
 * `AssistantMessageComponent` patch below drops that invisible line and
 * collapses the doubled spacers, leaving one blank line of air above and
 * below every block.
 */

import type { ExtensionAPI, Theme, ToolRenderers, ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import {
	AssistantMessageComponent,
	BranchSummaryMessageComponent,
	CompactionSummaryMessageComponent,
	CustomMessageComponent,
	SkillInvocationMessageComponent,
	UserMessageComponent,
} from "@earendil-works/pi-coding-agent";
import { Box, type Component, Markdown, MouseRegion, Spacer, Text, visibleWidth } from "@earendil-works/pi-tui";

/** Blank lines between the border and the content. */
const PAD_Y = 0;

/** A box with a rounded border and padding, sized to the width. */
class RoundedBox implements Component {
	private children: Component[] = [];
	private border: (text: string) => string = (text) => text;

	constructor(
		private insetX: number,
		private paddingX: number,
		private paddingY: number,
	) {}

	setBorder(border: (text: string) => string): void {
		this.border = border;
	}

	setChildren(children: Component[]): void {
		this.children = children;
	}

	invalidate(): void {
		for (const child of this.children) child.invalidate?.();
	}

	render(width: number): string[] {
		const inset = Math.min(this.insetX, Math.max(0, Math.floor((width - 4) / 2)));
		const boxWidth = Math.max(4, width - inset * 2);
		const inner = Math.max(1, boxWidth - 2);
		const contentWidth = Math.max(1, inner - this.paddingX * 2);

		const childLines: string[] = [];
		for (const child of this.children) childLines.push(...child.render(contentWidth));

		const lead = " ".repeat(inset);
		const blank = this.border("│") + " ".repeat(inner) + this.border("│");
		const lines: string[] = [lead + this.border(`╭${"─".repeat(inner)}╮`)];
		for (let i = 0; i < this.paddingY; i++) lines.push(lead + blank);

		const leftPad = " ".repeat(this.paddingX);
		for (const line of childLines) {
			const padded = leftPad + line;
			const fill = " ".repeat(Math.max(0, inner - visibleWidth(padded)));
			lines.push(lead + this.border("│") + padded + fill + this.border("│"));
		}

		for (let i = 0; i < this.paddingY; i++) lines.push(lead + blank);
		lines.push(lead + this.border(`╰${"─".repeat(inner)}╯`));
		return lines;
	}
}

/**
 * pi exports `ToolRenderContext` from its internal types module but does not
 * re-export it from the package root, so it is derived from the renderer
 * signature instead.
 */
type ToolRenderContext = Parameters<NonNullable<ToolRenderers["renderCall"]>>[2];

function borderFor(ctx: ToolRenderContext, theme: Theme): (text: string) => string {
	if (ctx.isPartial) return (text) => theme.fg("muted", text);
	if (ctx.isError) return (text) => theme.fg("error", text);
	return (text) => theme.fg("success", text);
}

/** The edit tool frames its call with its own filled Box; the border replaces the fill. */
function stripFill(component: unknown): void {
	if (component && typeof component === "object" && "bgFn" in component) {
		(component as { bgFn?: (text: string) => string }).bgFn = undefined;
	}
}

interface SubState {
	last?: Component;
}

interface BoxState {
	box?: RoundedBox;
	call?: SubState;
	result?: SubState;
	/** Shared with the wrapped renderer, which may keep state across call and result. */
	base?: Record<string, unknown>;
}

/**
 * What the patches need from the components. pi declares these fields private
 * in its type definitions, but they are plain properties at runtime, and the
 * extension shares module instances with pi, so the casts reach the real
 * objects. Every access is guarded, so a pi change degrades to pi's own
 * rendering instead of crashing the transcript.
 */
type UserMessageLike = {
	children: Component[];
	outputPad: number;
	markdownTheme: { link?: (text: string) => string };
	rebuild(): void;
	clear(): void;
	addChild(component: Component): void;
};

type MarkdownLike = {
	paddingX: number;
	paddingY: number;
	defaultTextStyle?: { color?: (text: string) => string; bgColor?: (text: string) => string };
};

type AssistantMessageLike = {
	contentContainer?: { children?: Component[] };
};

const ANSI_CSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

/** True for the hidden-thinking label: a mouse region around escape codes with no text. */
function isInvisibleLabel(child: unknown): boolean {
	if (!(child instanceof MouseRegion)) return false;
	const inner = (child as unknown as { child?: unknown }).child;
	if (!(inner instanceof Text)) return false;
	const text = (inner as unknown as { text?: string }).text ?? "";
	return text.replace(ANSI_CSI, "").trim() === "";
}

/** The user's prompt in a blue rounded border (mdLink is blue in both themes), with no fill. */
function patchUserMessage(): void {
	const proto = UserMessageComponent.prototype as unknown as { rebuild: (this: UserMessageLike) => void };
	const original = proto.rebuild;
	proto.rebuild = function (this: UserMessageLike) {
		original.call(this);
		const child = this.children?.[0];
		if (!(child instanceof Markdown) || this.children.length !== 1) return;

		// The box draws the padding; the Markdown keeps only its text colour.
		const markdown = child as unknown as MarkdownLike;
		markdown.paddingX = 0;
		markdown.paddingY = 0;
		if (markdown.defaultTextStyle) {
			markdown.defaultTextStyle = { ...markdown.defaultTextStyle, bgColor: undefined };
		}
		child.invalidate();

		const inset = Number.isFinite(this.outputPad) ? this.outputPad : 1;
		const box = new RoundedBox(inset, inset, PAD_Y);
		box.setBorder(this.markdownTheme?.link ?? ((text: string) => text));
		box.setChildren([child]);
		this.clear();
		this.addChild(box);
	};
}

/** Drop the invisible thinking-label line and the spacers it doubles up. */
function patchAssistantMessage(): void {
	const proto = AssistantMessageComponent.prototype as unknown as {
		updateContent: (this: AssistantMessageLike, message: unknown, isStreaming?: boolean) => void;
	};
	const original = proto.updateContent;
	proto.updateContent = function (message, isStreaming) {
		original.call(this, message, isStreaming);
		const children = this.contentContainer?.children;
		if (!children) return;

		const kept: Component[] = [];
		for (const child of children) {
			if (isInvisibleLabel(child)) continue;
			if (child instanceof Spacer && kept[kept.length - 1] instanceof Spacer) continue;
			kept.push(child);
		}
		// A message whose only content was hidden thinking renders nothing at
		// all: the tool blocks below carry their own blank line of air.
		this.contentContainer!.children = kept.every((child) => child instanceof Spacer) ? [] : kept;
	};
}

// --- system blocks (custom, compaction, branch, skill) ---------------------

/**
 * The UI api, captured on session start. Its `theme` getter returns the live
 * theme, so the borders follow theme switches.
 */
let uiApi: { theme: Theme } | null = null;

/** Neutral border for the system blocks: their text is muted in both themes. */
const mutedBorder = (text: string): string => uiApi?.theme.fg("muted", text) ?? text;

/** What the filled system blocks look like at runtime. */
type BoxMessageLike = {
	children: Component[];
	paddingX: number;
	render: (width: number) => string[];
};

/**
 * Renders a filled system Box (customMessageBg) as the same rounded border as
 * the other blocks, around the children the Box builds itself. The Box's own
 * padding and fill are bypassed entirely, and the children keep their place,
 * so pi's add/remove logic on rebuilds is unaffected.
 */
function borderBoxRender(this: BoxMessageLike, width: number): string[] {
	if (!this.children || this.children.length === 0) return [];
	const pad = Number.isFinite(this.paddingX) ? this.paddingX : 1;
	const box = new RoundedBox(pad, pad, PAD_Y);
	box.setBorder(mutedBorder);
	box.setChildren(this.children);
	return box.render(width);
}

/** The compaction, branch and skill blocks are Boxes themselves. */
function patchBoxMessageComponent(ComponentClass: { prototype: BoxMessageLike }): void {
	ComponentClass.prototype.render = borderBoxRender;
}

/** A custom message wraps the same Box in a Container; the Box gets the border. */
function patchCustomMessageComponent(): void {
	const proto = CustomMessageComponent.prototype as unknown as {
		rebuild: (this: { children: Component[]; box?: Component }) => void;
	};
	const original = proto.rebuild;
	proto.rebuild = function (this: { children: Component[]; box?: Component }) {
		original.call(this);
		const box = this.box;
		// Only the default rendering adds the box; a custom renderer draws its own component.
		if (!(box instanceof Box) || !(this.children ?? []).includes(box)) return;
		(box as unknown as BoxMessageLike).render = borderBoxRender;
	};
}

export default function (pi: ExtensionAPI) {
	// The component classes above are imported by name. pi loads extensions
	// through jiti, which turns a missing named export into undefined instead of
	// failing the import, so a pi update that renames or removes one would
	// otherwise throw on the first `.prototype` access and take every patch in
	// this file down with it. Each patch is guarded, so a missing class costs
	// only that block's border.
	if (UserMessageComponent) patchUserMessage();
	if (AssistantMessageComponent) patchAssistantMessage();
	if (CustomMessageComponent) patchCustomMessageComponent();
	if (CompactionSummaryMessageComponent)
		patchBoxMessageComponent(CompactionSummaryMessageComponent as unknown as { prototype: BoxMessageLike });
	if (BranchSummaryMessageComponent)
		patchBoxMessageComponent(BranchSummaryMessageComponent as unknown as { prototype: BoxMessageLike });
	if (SkillInvocationMessageComponent)
		patchBoxMessageComponent(SkillInvocationMessageComponent as unknown as { prototype: BoxMessageLike });

	pi.on("session_start", (_event, ctx) => {
		uiApi = ctx.ui;
	});

	pi.registerToolRenderer((_toolName, next) => {
		const base = next();
		if (!base?.renderCall || !base.renderResult) return base;

		// A "self" renderer (only the edit tool today) draws its own padding,
		// and its Box carries the block's background; both the padding and the
		// fill are dropped, and the border wraps the tool's own framing.
		const selfPadded = base.renderShell === "self";

		return {
			renderShell: "self",
			renderCall(args, theme, ctx) {
				const state = ctx.state as BoxState;
				const call = (state.call ??= {});
				const inner = base.renderCall!(args, theme, {
					...ctx,
					lastComponent: call.last,
					state: (state.base ??= {}),
				});
				call.last = inner;
				if (selfPadded) stripFill(inner);

				const box = (state.box ??= new RoundedBox(ctx.outputPad, selfPadded ? 0 : ctx.outputPad, selfPadded ? 0 : PAD_Y));
				box.setBorder(borderFor(ctx, theme));
				box.setChildren([inner]);
				return box;
			},
			renderResult(result, options: ToolRenderResultOptions, theme, ctx) {
				const state = ctx.state as BoxState;
				const sub = (state.result ??= {});
				const inner = base.renderResult!(result, options, theme, {
					...ctx,
					lastComponent: sub.last,
					state: (state.base ??= {}),
				});
				sub.last = inner;

				const box = state.box;
				if (box) {
					// The edit renderer re-colours its call Box when the preview lands.
					if (selfPadded) {
						stripFill(state.call?.last);
						stripFill(inner);
					}
					box.setBorder(borderFor(ctx, theme));
					box.setChildren([state.call?.last, inner].filter((c): c is Component => Boolean(c)));
				}
				return new Text("", 0, 0);
			},
		};
	});
}
