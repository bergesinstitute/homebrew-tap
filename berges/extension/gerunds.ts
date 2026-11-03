/**
 * Kitchen loader for pi: replaces the plain "Working" streaming message with a
 * slow cycle of cooking words and phrases, so a long turn looks alive instead
 * of stuck.
 *
 * The list is deliberately one theme rather than a thesaurus of synonyms for
 * "thinking", which is the register other agents' loaders use. Kitchen words
 * read as intentional, and the mix of short gerunds, rarer terms
 * (spatchcocking, chiffonading, confiting) and whole phrases ("tasting for
 * salt", "letting it rest") keeps the cycle from reading as a word list.
 *
 * pi colours the spinner with the theme's `accent` but hardcodes the message
 * to `muted`, and offers no token for it, so the word is coloured here with
 * `accent` too. In the Berges themes that is the brand red: #860000 in
 * berges-light, its dark equivalent in berges-dark, and the terminal's own
 * background picks which of the two is active.
 *
 * Thinking off by default is a setting, not an extension: see
 * `defaultThinkingLevel` in the defaults the `berges` script writes.
 *
 * The word changes on two signals. A timer fires at a random stretch inside a
 * window, so the pace drifts instead of ticking. On top of that, a tool
 * starting or a new turn beginning advances the word early, because something
 * actually happening is the honest reason to say a different word. The event
 * path is rate-limited, so a burst of tool calls cannot turn the drift back
 * into a metronome.
 */

import type { ExtensionAPI, ExtensionContext, ExtensionUIContext } from "@earendil-works/pi-coding-agent";

const WORDS = [
	"Kneading",
	"Reducing the sauce",
	"Zesting",
	"Proofing",
	"Tasting for salt",
	"Deglazing",
	"Sifting",
	"Folding in the eggs",
	"Searing",
	"Tempering",
	"Mise en place",
	"Julienning",
	"Checking the oven",
	"Braising",
	"Emulsifying",
	"Letting it rest",
	"Mincing",
	"Blanching",
	"Sharpening the knife",
	"Caramelizing",
	"Grating",
	"Bringing to a boil",
	"Basting",
	"Chiffonading",
	"Warming the pan",
	"Poaching",
	"Rendering",
	"Skimming the foam",
	"Curing",
	"Pickling",
	"Adjusting the heat",
	"Fermenting",
	"Dredging",
	"Plating it up",
	"Trussing",
	"Spatchcocking",
	"Cleaning as I go",
	"Torching",
	"Smoking",
	"Preheating the oven",
	"Charring",
	"Infusing",
	"Setting the table",
	"Muddling",
	"Decanting",
	"Serving it hot",
	"Straining",
	"Creaming",
	"Macerating",
	"Confiting",
	"Brining",
	"Flambéing",
	"Rolling",
	"Crimping",
];

/**
 * A word stays on screen for a random stretch inside this window. The spread
 * matters as much as the length: a fixed interval reads as a metronome, which
 * is the one thing a loader should not sound like.
 */
const MIN_WORD_MS = 4000;
const MAX_WORD_MS = 9000;

/**
 * How soon after a change an event may force another. Half the shortest
 * stretch, so events can at most double the pace, never exceed it.
 */
const EVENT_MIN_GAP_MS = MIN_WORD_MS / 2;

export default function (pi: ExtensionAPI) {
	// Kept fresh from every event so the timer never writes through a stale runtime.
	let ui: ExtensionUIContext | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let next = 0;
	let shownAt = 0;
	let enabled = true;

	const wait = () => MIN_WORD_MS + Math.random() * (MAX_WORD_MS - MIN_WORD_MS);

	// Idempotent: cancellation, reload, session replacement, and exit converge here.
	const stop = (restore: boolean) => {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
		// No argument hands the message back to pi.
		if (restore) ui?.setWorkingMessage();
	};

	const show = () => {
		if (!ui) return;
		// Coloured fresh every time rather than stored, so a theme flip is picked
		// up within one word. pi wraps the message in its own muted colour; the
		// escape below overrides it for the word, then resets.
		ui.setWorkingMessage(ui.theme.fg("accent", WORDS[next % WORDS.length]));
		shownAt = Date.now();
	};

	// Self-scheduling rather than setInterval, so every gap is its own draw
	// instead of one period repeated.
	const schedule = () => {
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(() => {
			next += 1;
			show();
			schedule();
		}, wait());
	};

	// An event advances the word only once it has been quiet for a while, then
	// re-arms from now, so the next gap is a fresh draw rather than the tail of
	// the one already running. A timer that is not armed means the loader is off
	// or the run has ended, and there is nothing to nudge.
	const nudge = (ctx: ExtensionContext) => {
		ui = ctx.ui;
		if (timer === undefined) return;
		if (Date.now() - shownAt < EVENT_MIN_GAP_MS) return;
		next += 1;
		show();
		schedule();
	};

	const start = (ctx: ExtensionContext) => {
		ui = ctx.ui;
		if (ctx.mode !== "tui" || !enabled) return;
		stop(false);
		// Start at a random word so back-to-back runs do not read the same.
		next = Math.floor(Math.random() * WORDS.length);
		show();
		schedule();
	};

	// A run can start again after agent_end (retry, compaction, queued message),
	// which just restarts the cycle.
	pi.on("agent_start", async (_event, ctx) => start(ctx));

	// Both mean the agent got somewhere new. turn_start lands right behind
	// agent_start, where the rate limit swallows it, so it only bites on the
	// later turns of a long run.
	pi.on("turn_start", async (_event, ctx) => nudge(ctx));
	pi.on("tool_execution_start", async (_event, ctx) => nudge(ctx));

	pi.on("agent_end", async (_event, ctx) => {
		ui = ctx.ui;
		stop(true);
	});

	pi.on("session_shutdown", async () => stop(true));

	pi.registerCommand("gerunds", {
		description: "Show the loader words, or turn the cycling loader message on or off.",
		handler: async (args: string, ctx: ExtensionContext) => {
			const picked = args.trim().toLowerCase();
			if (picked === "on" || picked === "off") {
				enabled = picked === "on";
				if (!enabled) {
					ui = ctx.ui;
					stop(true);
				}
				ctx.ui.notify(`Loader ${enabled ? "on" : "off"}.`, "info");
				return;
			}
			ctx.ui.notify(WORDS.join(", "), "info");
		},
	});
}
