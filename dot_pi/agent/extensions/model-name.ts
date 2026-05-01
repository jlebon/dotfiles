import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let modelName: string | undefined;

  pi.on("model_select", async (event) => {
    modelName = event.model.name;
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const name = modelName ?? ctx.model?.name;
    if (!name) return;
    return {
      systemPrompt:
        event.systemPrompt +
        `\n\nThe currently selected model's friendly name is: ${name}`,
    };
  });
}
