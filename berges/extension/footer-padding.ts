/**
 * Footer padding for pi: indents the built-in footer by the same number of
 * cells as the `editorPaddingX` setting, so the footer lines up with the
 * padded input editor and transcript instead of running edge to edge.
 *
 * pi has no footer padding setting, so this wraps the built-in
 * `FooterComponent` (exported by pi) in a thin component that renders its
 * lines indented. All footer content (cwd, branch, token stats, context
 * usage, model, thinking level, extension statuses) stays exactly as built in.
 */

import type { AgentSession, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { FooterComponent } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") {
			return;
		}

		const pad = Math.min(3, Math.max(0, pi.getSettings().editorPaddingX ?? 0));
		if (pad === 0) {
			ctx.ui.setFooter(undefined);
			return;
		}

		// FooterComponent expects an AgentSession. The extension context exposes the
		// same data (session manager, model, thinking level, context usage), so adapt
		// it. Getters keep the footer live across model switches and session growth.
		const sessionLike = {
			get sessionManager() {
				return ctx.sessionManager;
			},
			get model() {
				return ctx.model;
			},
			routedModel: undefined,
			get state() {
				return { model: ctx.model, thinkingLevel: ctx.thinkingLevel };
			},
			getContextUsage: () => ctx.getContextUsage(),
			modelRuntime: { isUsingSubscription: () => false },
		};

		ctx.ui.setFooter((_tui, _theme, footerData) => {
			const builtIn = new FooterComponent(sessionLike as unknown as AgentSession, footerData);
			builtIn.setAutoCompactEnabled(pi.getSettings().compaction?.enabled ?? true);
			const indent = " ".repeat(pad);

			return {
				render(width: number): string[] {
					return builtIn.render(Math.max(0, width - pad)).map((line) => `${indent}${line}`);
				},
				invalidate(): void {
					builtIn.invalidate();
				},
				dispose(): void {
					builtIn.dispose();
				},
			};
		});
	});
}
