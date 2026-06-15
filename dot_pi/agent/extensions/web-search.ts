import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const CURRENT_YEAR = new Date().getFullYear().toString();
const EXA_MCP_URL = "https://mcp.exa.ai/mcp";

const DESCRIPTION = `Search the web using Exa. Performs real-time web searches and returns content from the most relevant websites. Use this for accessing information beyond knowledge cutoff or for current events. The current year is ${CURRENT_YEAR}. You MUST use this year when searching for recent information.`;

const WebSearchSchema = Type.Object({
  query: Type.String({ description: "Search query" }),
  numResults: Type.Optional(
    Type.Number({ description: "Number of search results to return (default: 8)" })
  ),
  type: Type.Optional(
    Type.Union(
      [Type.Literal("auto"), Type.Literal("fast"), Type.Literal("deep")],
      {
        description:
          "Search type - 'auto': balanced (default), 'fast': quick, 'deep': comprehensive",
      }
    )
  ),
  livecrawl: Type.Optional(
    Type.Union(
      [Type.Literal("fallback"), Type.Literal("preferred")],
      {
        description:
          "Live crawl mode - 'fallback': use live crawling as backup (default), 'preferred': prioritize live crawling",
      }
    )
  ),
});

async function callExaMcp(
  query: string,
  opts: { numResults?: number; type?: string; livecrawl?: string },
  signal: AbortSignal
): Promise<string> {
  const apiKey = process.env.EXA_API_KEY;
  const url = apiKey
    ? `${EXA_MCP_URL}?exaApiKey=${encodeURIComponent(apiKey)}`
    : EXA_MCP_URL;

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "web_search_exa",
      arguments: {
        query,
        type: opts.type || "auto",
        numResults: opts.numResults || 8,
        livecrawl: opts.livecrawl || "fallback",
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Exa API error (${response.status}): ${await response.text()}`);
  }

  const raw = await response.text();
  return parseExaResponse(raw);
}

function parseExaResponse(raw: string): string {
  // Try parsing as direct JSON response
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    const text = extractMcpText(trimmed);
    if (text) return text;
  }

  // Try parsing as SSE stream
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const text = extractMcpText(line.substring(6));
    if (text) return text;
  }

  throw new Error("No results found in Exa response");
}

function extractMcpText(payload: string): string | undefined {
  try {
    const data = JSON.parse(payload.trim());
    const content = data?.result?.content;
    if (!Array.isArray(content)) return undefined;
    const item = content.find(
      (c: { type: string; text?: string }) => c.type === "text" && c.text
    );
    return item?.text;
  } catch {
    return undefined;
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: DESCRIPTION,
    parameters: WebSearchSchema,
    async execute(_toolCallId, params, signal, onUpdate) {
      onUpdate?.({
        content: [{ type: "text", text: `Searching for "${params.query}"...` }],
        details: {},
      });

      try {
        const text = await callExaMcp(
          params.query,
          {
            numResults: params.numResults,
            type: params.type,
            livecrawl: params.livecrawl,
          },
          signal
        );
        return {
          content: [{ type: "text", text }],
          details: { query: params.query },
        };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Search failed: ${e.message}` }],
          details: { error: true },
        };
      }
    },
  });
}
