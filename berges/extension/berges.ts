/**
 * Berges AI extension for pi: the startup header, and /pipeline and /chatbot
 * pickers that save the choice on this computer through the Berges AI API.
 * The model is picked with pi's own /model.
 *
 * The `berges` wrapper sets BERGES_API_URL and BERGES_BIN; the API key is read
 * with `berges key`, the same command the provider config uses.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
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

export default function (pi: ExtensionAPI) {
	let me: Me | null = null;

	const showHeader = (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setHeader((_tui, theme) => ({
			render(): string[] {
				// Bold, in the Berges red (#860000).
				const lines = ["", ` \x1b[1;38;2;134;0;0mBerges AI\x1b[22;39m`];
				// The terminal's own text colour, so it reads on light and dark backgrounds.
				if (me?.chatbot) lines.push(` \x1b[1m${me.chatbot.name}\x1b[22m`);
				const model = ctx.model?.name ?? ctx.model?.id;
				const layers = [me?.pipeline?.name, model].filter(Boolean).join(" + ");
				if (layers) lines.push(` ${layers}`);
				lines.push(` ${theme.fg("dim", "/model  /pipeline  /chatbot")}`, "");
				return lines;
			},
			invalidate() {},
		}));
	};

	pi.on("session_start", async (_event, ctx) => {
		showHeader(ctx);
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
