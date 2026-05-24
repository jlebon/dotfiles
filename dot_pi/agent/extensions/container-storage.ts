/**
 * Container Storage Extension
 *
 * Reports total storage used by the container's own mounts
 * (named/anonymous volumes and the HOME tmpfs) in the status bar.
 * Auto-discovers mounts via findmnt rather than hardcoding paths.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createLocalBashOperations,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    await updateStatus(ctx);
  });

  pi.on("tool_result", async (_event, ctx) => {
    await updateStatus(ctx);
  });

  pi.on("user_bash", (_event, ctx) => {
    const local = createLocalBashOperations();
    return {
      operations: {
        exec(command, cwd, options) {
          return local.exec(command, cwd, options).finally(() => updateStatus(ctx));
        },
      },
    };
  });
}

async function updateStatus(ctx: { ui: { setStatus: Function; theme: any } }) {
  try {
    const totalBytes = await measureContainerStorage();
    const theme = ctx.ui.theme;
    ctx.ui.setStatus(
      "container-storage",
      theme.fg("dim", "⛃ ") + theme.fg("muted", formatBytes(totalBytes)),
    );
  } catch {
    // silently ignore — findmnt/du may not be available
  }
}

async function measureContainerStorage(): Promise<number> {
  const targets = await discoverContainerMounts();
  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        const { stdout } = await execFileAsync("du", ["-sxb", target]);
        return parseInt(stdout.split("\t")[0], 10) || 0;
      } catch {
        return 0;
      }
    }),
  );
  return results.reduce((sum, n) => sum + n, 0);
}

async function discoverContainerMounts(): Promise<string[]> {
  const { stdout } = await execFileAsync("findmnt", [
    "--json",
    "-o",
    "TARGET,SOURCE,FSTYPE",
  ]);
  const data = JSON.parse(stdout);
  const all: { target: string; source: string; fstype: string }[] = [];
  flattenMounts(data.filesystems, all);

  const home = process.env.HOME || "/root";
  const mounts = all.filter(
    (m) =>
      m.source.includes("containers/storage/volumes/") ||
      (m.fstype === "tmpfs" && m.target === home),
  );

  // Deduplicate: remove child mounts under a parent with the same fstype,
  // since du -x won't stop at same-device bind mounts.
  mounts.sort((a, b) => a.target.length - b.target.length);
  const kept: typeof mounts = [];
  for (const m of mounts) {
    const dominated = kept.some(
      (p) => m.fstype === p.fstype && m.target.startsWith(p.target + "/"),
    );
    if (!dominated) kept.push(m);
  }

  return kept.map((m) => m.target);
}

function flattenMounts(
  nodes: any[],
  out: { target: string; source: string; fstype: string }[],
) {
  for (const node of nodes) {
    if (node.target) {
      out.push({
        target: node.target,
        source: node.source ?? "",
        fstype: node.fstype ?? "",
      });
    }
    if (node.children) flattenMounts(node.children, out);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const units = ["K", "M", "G", "T"];
  let value = bytes;
  let unit = "B";
  for (const u of units) {
    value /= 1024;
    unit = u;
    if (value < 1024) break;
  }
  return value < 10
    ? `${value.toFixed(1)}${unit}`
    : `${Math.round(value)}${unit}`;
}
