---
description: Commit all uncommitted changes as independent logical commits
---

Organize all uncommitted changes in the current git repo into independent,
logical commits. Each commit should group related changes by feature, bug fix,
or purpose.

## Steps

1. Run `git status` and `git diff --stat` to inventory all modified and
   untracked files. Ignore build artifacts (e.g. `__pycache__/`).

2. Load the `opencode-history` skill and query sessions for this project to
   understand the context behind each change. Use session titles and user
   messages to determine *why* changes were made. This is important for writing
   good commit messages.

3. Run `git diff` and study every change to understand what each modification
   does and which changes belong together.

4. Plan the commits: group related changes into logical units. A single file
   may need to be split across multiple commits if it contains unrelated
   changes (e.g. `xoc` with multiple independent features). Write the plan
   using the TodoWrite tool.

5. Execute the commits in dependency order (simple whole-file commits first,
   then partial-staging commits):
   - For files entirely in one commit: `git add <file>` and commit.
   - For files split across commits: use `git addhunks` to stage specific
     change groups by their line numbers in `git diff` output.
     After each partial commit, re-run `git diff | cat -n` to get updated line
     numbers for the next commit.

6. After all commits, run `git status` and `git log --oneline` to verify
   everything is clean and the commit history looks correct.
