/**
 * Editor Background Extension
 *
 * Gives the prompt editor the same gray background as user messages
 * in the chat history, with a ">>> " prompt indicator colored using
 * the editor border color, replacing the top/bottom divider lines.
 */

import {
  CustomEditor,
  type ExtensionAPI,
  type KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { EditorTheme, TUI } from "@mariozechner/pi-tui";

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const SGR_RESET = /\x1b\[0m/g;
const BG_RESET = "\x1b[49m";
const PROMPT_STR = ">>> ";
const PROMPT_WIDTH = 4;
const INDENT = "    ";

class BgEditor extends CustomEditor {
  private bgOpen: string;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    bgOpen: string,
  ) {
    super(tui, theme, keybindings);
    this.bgOpen = bgOpen;
  }

  render(width: number): string[] {
    const raw = super.render(width - PROMPT_WIDTH);
    const bg = this.bgOpen;
    const prompt = this.borderColor("\x1b[1m" + PROMPT_STR + "\x1b[22m");
    const result: string[] = [];
    let firstContent = true;

    for (const line of raw) {
      // Replace border/scroll indicator lines with blank lines
      const visible = line.replace(ANSI_RE, "");
      if (visible.length > 0 && visible.charAt(0) === "─") {
        const patched = " ".repeat(width);
        result.push(`${bg}${patched}${BG_RESET}`);
        continue;
      }

      const prefix = firstContent ? prompt : INDENT;
      firstContent = false;

      // Apply background, re-applying after any full SGR reset (cursor rendering)
      const combined = prefix + line;
      const patched = combined.replace(SGR_RESET, `\x1b[0m${bg}`);
      result.push(`${bg}${patched}${BG_RESET}`);
    }

    return result;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const theme = ctx.ui.theme;
    // Extract raw background ANSI open code from theme.bg() output:
    // theme.bg() returns "<open>text<close>" where close is \x1b[49m (5 chars)
    const probe = theme.bg("userMessageBg", "");
    const bgOpen = probe.slice(0, probe.length - BG_RESET.length);
    if (!bgOpen) return;

    ctx.ui.setEditorComponent((tui, editorTheme, keybindings) =>
      new BgEditor(tui, editorTheme, keybindings, bgOpen),
    );
  });
}
