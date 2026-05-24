/**
 * Container Name Extension
 *
 * Reads the container name from /run/.containerenv at startup
 * and displays it in the status bar.
 */

import { readFileSync } from "node:fs";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    let contents: string;
    try {
      contents = readFileSync("/run/.containerenv", "utf-8");
    } catch {
      return;
    }

    const match = contents.match(/^name="(.+)"$/m);
    if (!match) return;

    const theme = ctx.ui.theme;
    ctx.ui.setStatus(
      "container",
      theme.fg("dim", "📦 ") + theme.fg("muted", match[1]),
    );
  });
}
