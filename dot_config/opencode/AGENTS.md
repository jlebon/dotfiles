- Git repos for all codebases are under ~/Code.
- When working in a git repo, if the .git repo is not read-only, you SHOULD
  create a git commit using `git commit -am` (NOT -A).
- When writing git messages:
  - You MUST add "Assisted-by: MODEL" trailers, where MODEL is the friendly model name (e.g. "Claude Opus 4.5"). You MUST NOT include the API codename.
  - If you know why the change is being made, you MUST focus on the "why", not the "what".
  - If you don't know why the change is being made, you MUST NOT invent a reason.
  - You MUST summarize the "what" using prose, not bullet points.
- When adding new functions in codebase, you MUST respect "canonical order", i.e.: 
  - Public functions MUST be first (ordered by data flow lifecycle: constructions, core operations, cleanup)
  - Private functions MUST be in depth-first order of their first call from public functions
- You MUST use the gh tool to interact with GitHub. You MUST NOT use WebFetch.
- You MUST use the glab tool to interact with GitLab. You MUST NOT use WebFetch.
- If you want to run something on the host or in the host context, use
  `hostexec run <command> [args...]`. This will prompt the user for approval.
- For read-write `gh` operations (e.g. creating PRs, merging, commenting), run
  `gh` in the host context.
