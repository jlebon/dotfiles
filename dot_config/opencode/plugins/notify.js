// Notify on the host when:
// - a session goes idle (ready for the next message)
// - the agent asks a question or presents the plan exit prompt
// Skip subagent sessions by checking parentID so we only notify once.
export const NotifyPlugin = async ({ client, $ }) => {
  return {
    "tool.execute.before": async (input, _output) => {
      if (input.tool !== "question" && input.tool !== "plan_exit") return;
      await $`hostexec notify`;
    },
    event: async ({ event }) => {
      if (event.type !== "session.idle") return;
      const res = await client.session.get({
        path: { id: event.properties.sessionID },
      });
      if (res.data?.parentID) return;
      await $`hostexec notify`;
    },
  };
};
