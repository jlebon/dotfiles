// Fire hostexec hooks to update tmux window indicators and send bell
// notifications when the agent transitions between states:
//   session-start -> 🤖  (opencode loaded)
//   busy          -> ⏳  (agent working)
//   idle          -> ✋🔔 (agent needs input)
//   session-exit  ->     (clean up)
// Skip subagent sessions for status events so we only notify once.
export const NotifyPlugin = async ({ client, $ }) => {
  await $`hostexec notify session-start`;

  const isTopLevel = async (sessionID) => {
    const res = await client.session.get({ path: { id: sessionID } });
    return !res.data?.parentID;
  };

  return {
    "tool.execute.before": async (input, _output) => {
      if (input.tool !== "question" && input.tool !== "plan_exit") return;
      await $`hostexec notify idle`;
    },
    "tool.execute.after": async (input, _output) => {
      if (input.tool !== "question") return;
      await $`hostexec notify busy`;
    },
    event: async ({ event }) => {
      if (event.type === "global.disposed") {
        await $`hostexec notify session-exit`;
        return;
      }
      if (event.type !== "session.status") return;
      const { sessionID, status } = event.properties;
      if (!(await isTopLevel(sessionID))) return;
      if (status.type === "busy") {
        await $`hostexec notify busy`;
      } else if (status.type === "idle") {
        await $`hostexec notify idle`;
      }
    },
  };
};
