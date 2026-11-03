/**
 * Berges AI extension for pi: the startup header, the blanked-out placeholder
 * for a hidden thinking block, and /pipeline and /chatbot pickers that save
 * the choice on this computer through the Berges AI API.
 * The model is picked with pi's own /model.
 *
 * The `berges` wrapper sets BERGES_API_URL and BERGES_BIN; the API key is read
 * with `berges key`, the same command the provider config uses.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { execFileSync } from "node:child_process";

type Option = { id: string; name: string; adjective?: string };

type Me = {
	pipelines: Option[];
	pipeline: Option | null;
	chatbots: Option[];
	chatbot: Option | null;
};

const apiUrl = process.env.BERGES_API_URL ?? "https://berges.ai/api/v1";

function apiKey(): string {
	return execFileSync(process.env.BERGES_BIN ?? "berges", ["key"], { encoding: "utf8" }).trim();
}

async function api(method: "GET" | "PATCH", body?: Record<string, string>): Promise<Me> {
	const response = await fetch(`${apiUrl}/me`, {
		method,
		headers: {
			Authorization: `Bearer ${apiKey()}`,
			Accept: "application/json",
			...(body ? { "Content-Type": "application/json" } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!response.ok) {
		const json = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
		throw new Error(json?.error?.message ?? `Berges AI answered ${response.status}.`);
	}
	return (await response.json()) as Me;
}

/** Compact token counts, matching pi's default footer. */
function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

/** The current directory, with the home directory shortened to ~. */
function formatDir(cwd: string): string {
	const home = process.env.HOME || process.env.USERPROFILE;
	if (!home) return cwd;
	if (cwd === home) return "~";
	if (cwd.startsWith(`${home}/`)) return `~${cwd.slice(home.length)}`;
	return cwd;
}

export default function (pi: ExtensionAPI) {
	let me: Me | null = null;

	const showHeader = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setHeader((_tui, theme) => ({
			render(): string[] {
				// Bold, in the brand red: #860000 in berges-light, its dark
				// equivalent in berges-dark. This runs inside the render callback,
				// so it picks up a theme change with no rebuilding of its own.
				const lines = ["", ` ${theme.style("Berges AI", { fg: "accent", bold: true })}`];
				// The terminal's own text colour, so it reads on light and dark backgrounds.
				if (me?.chatbot) lines.push(` ${theme.bold(me.chatbot.name)}`);
				const model = ctx.model?.name ?? ctx.model?.id;
				const layers = [me?.pipeline?.name, model].filter(Boolean).join(" + ");
				if (layers) lines.push(` ${layers}`);
				lines.push(` ${theme.fg("dim", "/model  /pipeline  /chatbot")}`, "");
				return lines;
			},
			invalidate() {},
		}));
	};

	// With thinking blocks hidden, pi puts a "Thinking..." label in their place.
	// The kitchen loader already says the turn is alive, so the label is blanked.
	// An empty string still leaves a line of escape codes with no text, which
	// pi's Text renders as a blank line; blocks.ts removes that line and the
	// spacers pi groups around it, so blocks keep even spacing. The empty
	// string has to be passed explicitly, because calling with no argument
	// restores pi's default rather than clearing it.
	//
	// Set once: pi hands the current label to every assistant message it builds
	// afterwards, and with no colour in it there is nothing to go stale on a
	// theme flip. Ctrl+T still expands the reasoning; only the click target
	// goes, since there is no line left to click.
	const hideThinkingLabel = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setHiddenThinkingLabel("");
	};

	// The footer keeps the current directory on the left and the session's
	// metrics on the right. pi's default also puts the model name on the right;
	// here the model is already in the header, next to the pipeline and chatbot,
	// so the footer drops it and gives the metrics the whole right side.
	const showFooter = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());
			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					const branch = footerData.getGitBranch();
					const dir = formatDir(ctx.cwd);
					const left = theme.fg("dim", branch ? `${dir} (${branch})` : dir);

					let input = 0,
						output = 0,
						cacheRead = 0,
						cacheWrite = 0,
						cost = 0;
					for (const entry of ctx.sessionManager.getEntries()) {
						const usage =
							entry.type === "usage"
								? entry.usage
								: entry.type === "message" && entry.message.role === "assistant"
									? entry.message.usage
									: entry.type === "message" && entry.message.role === "toolResult"
										? entry.message.usage
										: entry.type === "compaction" || entry.type === "branch_summary"
											? entry.usage
											: undefined;
						if (!usage) continue;
						input += usage.input;
						output += usage.output;
						cacheRead += usage.cacheRead;
						cacheWrite += usage.cacheWrite;
						cost += usage.cost.total;
					}

					const dim = (text: string) => theme.fg("dim", text);
					const parts: string[] = [];
					if (input) parts.push(dim(`↑${formatTokens(input)}`));
					if (output) parts.push(dim(`↓${formatTokens(output)}`));
					if (cacheRead) parts.push(dim(`R${formatTokens(cacheRead)}`));
					if (cacheWrite) parts.push(dim(`W${formatTokens(cacheWrite)}`));
					if (cost) parts.push(dim(`$${cost.toFixed(3)}`));

					const usage = ctx.getContextUsage();
					const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
					const percent = usage?.percent ?? null;
					const contextText =
						percent === null
							? `?/${formatTokens(contextWindow)}`
							: `${percent.toFixed(1)}%/${formatTokens(contextWindow)}`;
					parts.push(
						percent !== null && percent > 90
							? theme.fg("error", contextText)
							: percent !== null && percent > 70
								? theme.fg("warning", contextText)
								: dim(contextText),
					);

					const right = parts.join(" ");
					const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
					return [truncateToWidth(left + pad + right, width)];
				},
			};
		});
	};

	pi.on("session_start", async (_event, ctx) => {
		showHeader(ctx);
		showFooter(ctx);
		hideThinkingLabel(ctx);
		try {
			me = await api("GET");
			showHeader(ctx);
		} catch (error) {
			if (ctx.hasUI) ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
		}
	});

	pi.on("model_select", async (_event, ctx) => showHeader(ctx));

	const picker = (kind: "pipeline" | "chatbot") => ({
		description: kind === "pipeline" ? "Pick the Berges AI pipeline" : "Pick the Berges AI chatbot",
		handler: async (args: string, ctx: ExtensionContext) => {
			try {
				me ??= await api("GET");
				const options = kind === "pipeline" ? me.pipelines : me.chatbots;
				const current = kind === "pipeline" ? me.pipeline : me.chatbot;
				const label = (option: Option) =>
					(option.adjective ? `${option.name} (${option.adjective})` : option.name) +
					(option.id === current?.id ? " (current)" : "");

				let picked = args.trim();
				if (!picked) {
					const choice = await ctx.ui.select(kind === "pipeline" ? "Pipeline" : "Chatbot", options.map(label));
					if (!choice) return;
					picked = options[options.map(label).indexOf(choice)]?.id ?? "";
				}

				me = await api("PATCH", { [kind]: picked });
				const now = kind === "pipeline" ? me.pipeline : me.chatbot;
				showHeader(ctx);
				ctx.ui.notify(`${kind === "pipeline" ? "Pipeline" : "Chatbot"} set to ${now?.name}.`, "info");
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});

	pi.registerCommand("pipeline", picker("pipeline"));
	pi.registerCommand("chatbot", picker("chatbot"));
}
