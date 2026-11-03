/**
 * Gerund loader for pi: replaces the plain "Working" streaming message with a
 * slow cycle of gerunds, so a long turn looks alive instead of stuck.
 *
 * pi themes the loader message itself (muted by default), so the words are
 * passed as plain text and pick up the active Berges theme. The spinner next
 * to them stays pi's own.
 *
 * Thinking off by default is a setting, not an extension: see
 * `defaultThinkingLevel` in the defaults the `berges` script writes.
 */

import type { ExtensionAPI, ExtensionContext, ExtensionUIContext } from "@earendil-works/pi-coding-agent";

const GERUNDS = [
	"Thinking",
	"Pondering",
	"Contemplating",
	"Mulling",
	"Ruminating",
	"Deliberating",
	"Considering",
	"Musing",
	"Reflecting",
	"Cogitating",
	"Reasoning",
	"Computing",
	"Percolating",
	"Simmering",
	"Marinating",
	"Noodling",
	"Untangling",
	"Conjuring",
	"Brewing",
	"Working",
];

/** How long each word stays on screen. */
const WORD_MS = 1200;

export default function (pi: ExtensionAPI) {
	// Kept fresh from every event so the timer never writes through a stale runtime.
	let ui: ExtensionUIContext | null = null;
	let timer: ReturnType<typeof setInterval> | undefined;
	let next = 0;
	let enabled = true;

	// Idempotent: cancellation, reload, session replacement, and exit converge here.
	const stop = (restore: boolean) => {
		if (timer !== undefined) clearInterval(timer);
		timer = undefined;
		// No argument hands the message back to pi.
		if (restore) ui?.setWorkingMessage();
	};

	const start = (ctx: ExtensionContext) => {
		ui = ctx.ui;
		if (ctx.mode !== "tui" || !enabled) return;
		stop(false);
		// Start at a random word so back-to-back runs do not read the same.
		next = Math.floor(Math.random() * GERUNDS.length);
		const tick = () => {
			ui?.setWorkingMessage(GERUNDS[next % GERUNDS.length]);
			next += 1;
		};
		tick();
		timer = setInterval(tick, WORD_MS);
	};

	// A run can start again after agent_end (retry, compaction, queued message),
	// which just restarts the cycle.
	pi.on("agent_start", async (_event, ctx) => start(ctx));

	pi.on("agent_end", async (_event, ctx) => {
		ui = ctx.ui;
		stop(true);
	});

	pi.on("session_shutdown", async () => stop(true));

	pi.registerCommand("gerunds", {
		description: "Show the gerund list, or turn the cycling loader message on or off.",
		handler: async (args: string, ctx: ExtensionContext) => {
			const picked = args.trim().toLowerCase();
			if (picked === "on" || picked === "off") {
				enabled = picked === "on";
				if (!enabled) {
					ui = ctx.ui;
					stop(true);
				}
				ctx.ui.notify(`Gerund loader ${enabled ? "on" : "off"}.`, "info");
				return;
			}
			ctx.ui.notify(GERUNDS.join(", "), "info");
		},
	});
}
