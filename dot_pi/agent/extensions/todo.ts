import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type, type Static } from "typebox";

const TodoItem = Type.Object({
  content: Type.String({ description: "Brief description of the task" }),
  status: StringEnum(
    ["pending", "in_progress", "completed", "cancelled"] as const,
    { description: "Current status" },
  ),
  priority: StringEnum(
    ["high", "medium", "low"] as const,
    { description: "Priority level" },
  ),
});

type TodoItem = Static<typeof TodoItem>;

const ENTRY_TYPE = "todo-state";

const STATUS_ICONS: Record<string, string> = {
  pending: "○",
  in_progress: "▶",
  completed: "✓",
  cancelled: "✗",
};

export default function (pi: ExtensionAPI) {
  let todos: TodoItem[] = [];

  function updateStatus(ctx: ExtensionContext): void {
    const done = todos.filter(
      (t) => t.status === "completed" || t.status === "cancelled",
    ).length;
    if (todos.length === 0 || done === todos.length) {
      ctx.ui.setStatus("todo", undefined);
      return;
    }
    ctx.ui.setStatus(
      "todo",
      ctx.ui.theme.fg("accent", `📋 ${done}/${todos.length}`),
    );
  }

  function formatTodos(): string {
    if (todos.length === 0) return "No todos.";
    return todos
      .map((t, i) => {
        const icon = STATUS_ICONS[t.status] ?? "?";
        return `${i + 1}. [${icon}] [${t.priority}] ${t.content}`;
      })
      .join("\n");
  }

  pi.registerTool({
    name: "todo",
    label: "Todo",
    description: `Manage a task list for the current session to track progress on complex, multi-step tasks.

Use the todo tool when:
- A task requires 3+ distinct steps
- The user provides multiple tasks
- The user explicitly asks for a todo list
- You need to track progress on non-trivial work

Do NOT use the todo tool for single trivial tasks, conversational questions, or tasks completable in under 3 steps.

Task management rules:
- Keep only ONE task as in_progress at a time
- Mark tasks complete immediately after finishing
- Complete existing tasks before starting new ones
- Update the list as new information or follow-up tasks emerge`,
    promptSnippet: "Track progress on multi-step tasks with a todo list",
    parameters: Type.Object({
      command: StringEnum(["read", "update"] as const, {
        description:
          "read: return the current todo list. update: replace the entire todo list with the provided items.",
      }),
      todos: Type.Optional(
        Type.Array(TodoItem, {
          description: "Required for 'update'. The full replacement todo list.",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (params.command === "read") {
        return {
          content: [{ type: "text", text: formatTodos() }],
          details: { todos },
        };
      }

      if (!params.todos) {
        return {
          content: [
            {
              type: "text",
              text: "Error: 'todos' parameter is required for the update command.",
            },
          ],
          details: {},
          isError: true,
        };
      }

      todos = params.todos;
      pi.appendEntry(ENTRY_TYPE, { todos });
      updateStatus(ctx);

      const remaining = todos.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled",
      ).length;
      return {
        content: [
          {
            type: "text",
            text: `Updated: ${remaining} remaining.\n\n${formatTodos()}`,
          },
        ],
        details: { todos },
      };
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    const last = entries
      .filter(
        (e: { type: string; customType?: string }) =>
          e.type === "custom" && e.customType === ENTRY_TYPE,
      )
      .pop() as { data?: { todos: TodoItem[] } } | undefined;

    if (last?.data?.todos) {
      todos = last.data.todos;
    }
    updateStatus(ctx);
  });
}
