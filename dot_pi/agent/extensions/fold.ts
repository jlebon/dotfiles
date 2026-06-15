import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("fold", {
		description: "Fold recent messages into a summary and navigate back to the last branch summary",
		handler: async (_args, ctx) => {
			const branch = ctx.sessionManager.getBranch();

			let targetId: string | undefined;
			for (let i = branch.length - 1; i >= 0; i--) {
				if (branch[i].type === "branch_summary") {
					targetId = branch[i].id;
					break;
				}
			}

			if (!targetId) {
				ctx.ui.notify("No branch summary to fold back to", "error");
				return;
			}

			const result = await ctx.ui.custom<{ cancelled: boolean } | null>((tui, theme, _kb, done) => {
				const loader = new BorderedLoader(tui, theme, "Folding...");
				loader.onAbort = () => done(null);

				ctx.navigateTree(targetId!, { summarize: true })
					.then((r) => done(r))
					.catch(() => done(null));

				return loader;
			});

			if (!result || result.cancelled) {
				ctx.ui.notify("Fold cancelled", "warning");
				return;
			}

			ctx.ui.notify("Folded to last branch summary", "info");
		},
	});
}
