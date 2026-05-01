---
description: Commit all uncommitted changes as independent logical commits
---

Organize all uncommitted changes in the current git repo into independent,
logical commits. Each commit should group related changes by feature, bug fix,
or purpose.

## Steps

1. Run `git status` and `git diff --stat` to inventory all modified and
   untracked files. Ignore build artifacts (e.g. `__pycache__/`).

2. Search recent Pi session files for this project to understand the context
   behind each change. Sessions are JSONL files stored under
   `~/.pi/agent/sessions/`. Find the right subdirectory by looking for one
   matching the current working directory, then extract user messages from
   recent sessions:

   ```bash
   SESSION_DIR=$(find ~/.pi/agent/sessions/ -maxdepth 1 -type d | grep "$(pwd | sed 's|/|-|g; s|^-|--|; s|$|--|')" | head -1)
   if [ -n "$SESSION_DIR" ]; then
     for f in $(ls -t "$SESSION_DIR"/*.jsonl | head -5); do
       echo "=== $(basename "$f") ==="
       grep '"role":"user"' "$f" | head -20 | while read -r line; do
         echo "$line" | jq -r '.message.content // empty' 2>/dev/null | head -c 200
         echo
       done
     done
   fi
   ```

   Use session context and user messages to determine *why* changes were made.
   This is important for writing good commit messages.

3. Run `git diff` and study every change to understand what each modification
   does and which changes belong together.

4. Plan the commits: group related changes into logical units. A single file
   may need to be split across multiple commits if it contains unrelated
   changes. Write the plan out explicitly before executing.

5. Execute the commits in dependency order (simple whole-file commits first,
   then partial-staging commits):
   - For files entirely in one commit: `git add <file>` and commit.
   - For files split across commits: use `git addhunks` to stage specific
     change groups by their line numbers in `git diff` output.
     After each partial commit, re-run `git diff | cat -n` to get updated line
     numbers for the next commit.

6. After all commits, run `git status` and `git log --oneline` to verify
   everything is clean and the commit history looks correct.
