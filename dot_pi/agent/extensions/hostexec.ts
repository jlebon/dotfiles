import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const hasHostexec = !!process.env.HOSTEXEC_SOCKET;
  if (!hasHostexec) return;

  const notify = async (hook: string) => {
    try {
      await pi.exec("hostexec", ["notify", hook]);
    } catch {
      // ignore
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    await notify("session-start");
  });

  pi.on("agent_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    await notify("busy");
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    await notify("idle");
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    await notify("session-exit");
  });
}
