---
name: pi-history
description: Query Pi session history from JSONL session files.
---

# Pi Session History

Query Pi agent session history to inspect past sessions, messages, tool
usage, token consumption, and costs.

## Session Storage

Sessions are stored as JSONL files (one JSON object per line) under
`~/.pi/agent/sessions/`. Each project has its own subdirectory named
after the working directory with `/` replaced by `-` and wrapped in
`--`:

```
~/.pi/agent/sessions/--var-home-jlebon-Code-project--/
```

Session filenames encode the timestamp and session ID:

```
2026-05-25T15-42-41-964Z_019e5fcd-792c-72d0-8e30-75a013184ca7.jsonl
```

## JSONL Record Types

Each line is a JSON object with a `type` field. The record types are:

- **`session`** -- First line. Contains `version`, `id`, `timestamp`,
  and `cwd` (working directory).
- **`model_change`** -- Model selection. Contains `provider`, `modelId`,
  `parentId`, `timestamp`.
- **`thinking_level_change`** -- Thinking level setting. Contains
  `thinkingLevel`, `parentId`, `timestamp`.
- **`message`** -- A conversation message. Contains a `message` object
  with `role` and role-specific fields (see below).

## Message Roles

The `message.role` field determines the message structure:

- **`user`** -- User input. `content` is an array of `{type, text}`
  objects.
- **`assistant`** -- Model response. Has `model`, `provider`,
  `stopReason`, `usage` (with token counts and costs), and `content`
  (array of typed content blocks).
- **`toolResult`** -- Tool execution result. Has `toolName`,
  `toolCallId`, `isError`, and `content` (JSON string of results).
- **`bashExecution`** -- Direct bash execution (from TUI). Has
  `command`, `exitCode`, `output`, `cancelled`, `truncated`.

## Assistant Message Structure

Assistant messages have these key fields:

- `model` -- Model ID (e.g., `claude-opus-4-6`)
- `provider` -- Provider name (e.g., `anthropic-vertex`)
- `stopReason` -- Why generation stopped (`toolUse`, `endTurn`, etc.)
- `usage.input` -- Input token count
- `usage.output` -- Output token count
- `usage.cacheRead` -- Cached input tokens read
- `usage.cacheWrite` -- Cached input tokens written
- `usage.totalTokens` -- Total tokens
- `usage.cost.input` -- Input cost in dollars
- `usage.cost.output` -- Output cost in dollars
- `usage.cost.cacheRead` -- Cache read cost
- `usage.cost.cacheWrite` -- Cache write cost
- `usage.cost.total` -- Total cost for this response

## Assistant Content Types

The `content` array in assistant messages contains typed blocks:

- `{type: "thinking", text}` -- Model reasoning
- `{type: "text", text}` -- Visible text response
- `{type: "toolCall", id, name, arguments}` -- Tool invocation with
  `name` (e.g., `read`, `bash`, `edit`, `write`) and `arguments` object

## Querying

All queries use `jq` on the JSONL files. The session directory for a
project can be found with:

```bash
SESSION_DIR=$(find ~/.pi/agent/sessions/ -maxdepth 1 -type d \
  | grep -F -- "$(pwd | sed 's|/|-|g; s|^-|--|; s|$|--|')" | head -1)
```

### List recent sessions for current project

```bash
SESSION_DIR=$(find ~/.pi/agent/sessions/ -maxdepth 1 -type d \
  | grep -F -- "$(pwd | sed 's|/|-|g; s|^-|--|; s|$|--|')" | head -1)
for f in $(ls -t "$SESSION_DIR"/*.jsonl | head -10); do
  jq -r 'select(.type == "session") |
    "\(.id)  \(.timestamp)  \(.cwd)"' "$f"
done
```

### List all project directories with session counts

```bash
for d in ~/.pi/agent/sessions/--*/; do
  count=$(ls "$d"/*.jsonl 2>/dev/null | wc -l)
  name=$(basename "$d" | sed 's/^--//; s/--$//; s/-/\//g')
  printf "%4d  /%s\n" "$count" "$name"
done | sort -rn
```

### Read user messages from a session

```bash
jq -r 'select(.type == "message" and .message.role == "user") |
  .message.content[] | select(.type == "text") | .text' \
  SESSION_FILE
```

### Read conversation transcript (user + assistant text)

```bash
jq -r 'select(.type == "message") |
  if .message.role == "user" then
    ">>> USER:\n" + (.message.content[] | select(.type == "text") | .text)
  elif .message.role == "assistant" then
    (.message.content[] | select(.type == "text") | .text // empty)
  else empty end' \
  SESSION_FILE
```

### List tool calls in a session

```bash
jq -r 'select(.type == "message" and .message.role == "assistant") |
  .message.content[] | select(.type == "toolCall") |
  "\(.name)\t\(.arguments | tostring | .[0:80])"' \
  SESSION_FILE
```

### Token usage and cost per assistant message

```bash
jq -r 'select(.type == "message" and .message.role == "assistant") |
  .message | [.model, .usage.input, .usage.output,
  .usage.cacheRead, .usage.cacheWrite,
  (.usage.cost.total | tostring | .[0:8])] |
  @tsv' \
  SESSION_FILE
```

### Total cost for a session

```bash
jq -s '[.[] | select(.type == "message" and .message.role == "assistant") |
  .message.usage.cost.total // 0] | add' \
  SESSION_FILE
```

### Search recent sessions for user messages matching a term

```bash
SESSION_DIR=$(find ~/.pi/agent/sessions/ -maxdepth 1 -type d \
  | grep -F -- "$(pwd | sed 's|/|-|g; s|^-|--|; s|$|--|')" | head -1)
for f in $(ls -t "$SESSION_DIR"/*.jsonl | head -20); do
  matches=$(jq -r 'select(.type == "message" and .message.role == "user") |
    .message.content[] | select(.type == "text") |
    .text' "$f" | grep -i "SEARCH_TERM" || true)
  if [ -n "$matches" ]; then
    echo "=== $(basename "$f") ==="
    echo "$matches"
  fi
done
```

### Cost summary across recent sessions for current project

```bash
SESSION_DIR=$(find ~/.pi/agent/sessions/ -maxdepth 1 -type d \
  | grep -F -- "$(pwd | sed 's|/|-|g; s|^-|--|; s|$|--|')" | head -1)
for f in $(ls -t "$SESSION_DIR"/*.jsonl | head -20); do
  cost=$(jq -s '[.[] | select(.type == "message" and .message.role == "assistant") |
    .message.usage.cost.total // 0] | add' "$f")
  ts=$(jq -r 'select(.type == "session") | .timestamp' "$f")
  first_msg=$(jq -r 'select(.type == "message" and .message.role == "user") |
    .message.content[] | select(.type == "text") |
    .text[0:80]' "$f" | head -1)
  printf "%-26s  $%s  %s\n" "$ts" "$cost" "$first_msg"
done
```

### Extract user messages from recent sessions (for commit context)

This is the pattern used by the `commitall` prompt template to
understand why changes were made:

```bash
SESSION_DIR=$(find ~/.pi/agent/sessions/ -maxdepth 1 -type d \
  | grep -F -- "$(pwd | sed 's|/|-|g; s|^-|--|; s|$|--|')" | head -1)
if [ -n "$SESSION_DIR" ]; then
  for f in $(ls -t "$SESSION_DIR"/*.jsonl | head -5); do
    echo "=== $(basename "$f") ==="
    jq -r 'select(.type == "message" and .message.role == "user") |
      .message.content[] | select(.type == "text") |
      .text[0:200]' "$f" | head -20
  done
fi
```

## Notes

- Session files are plain JSONL; no database needed.
- Files are safe to query while Pi is running (append-only writes).
- Session directory names use the `--path-segments--` convention where
  `/` becomes `-`.
- Use `ls -t` to sort session files by modification time (most recent
  first).
- Use `jq -s` (slurp) when aggregating across lines (e.g., summing
  costs), plain `jq` for per-line filtering.
- The `version` field in the session record tracks format changes
  (currently version 3).
