---
name: opencode-history
description: Query the OpenCode session history SQLite database.
---

# OpenCode Session History

Query the OpenCode session history database to inspect past sessions,
messages, tool usage, token consumption, and costs.

## Database Location

The database is a SQLite file at `~/.local/share/opencode/opencode.db`.

## Schema Overview

The key tables are:

- **`session`** -- One row per conversation session. Key columns: `id`,
  `project_id`, `title`, `directory`, `time_created`, `time_updated`,
  `time_archived`, `parent_id`, `summary_additions`, `summary_deletions`,
  `summary_files`.
- **`message`** -- One row per user or assistant message. Key columns:
  `id`, `session_id`, `time_created`, `data` (JSON with `role`, `agent`,
  `modelID`, `providerID`, `cost`, `tokens`).
- **`part`** -- One row per message part (text, tool call, reasoning,
  etc.). Key columns: `id`, `message_id`, `session_id`, `data` (JSON
  with `type` and type-specific fields).
- **`project`** -- One row per project. Key columns: `id`, `worktree`,
  `name`.

Timestamps are stored as epoch milliseconds. Use
`datetime(col/1000, 'unixepoch', 'localtime')` to format them.

The `message.data` JSON has these key fields by role:
- **user**: `role`, `format`, `summary`, `agent`, `model`
- **assistant**: `role`, `parentID`, `modelID`, `providerID`, `cost`,
  `tokens` (`input`, `output`, `reasoning`, `cache.read`, `cache.write`),
  `error`, `finish`

The `part.data` JSON has a `type` discriminator. Common types: `text`
(has `text`), `tool` (has `tool`, `callID`, `state` with `status`,
`input`, `output`), `reasoning` (has `text`), `step-finish` (has
`cost`, `tokens`).

## Querying

All queries use `sqlite3 ~/.local/share/opencode/opencode.db`. Set
column mode for readability:

```bash
DB=~/.local/share/opencode/opencode.db
```

### List recent sessions

```bash
sqlite3 "$DB" "
  SELECT s.id, s.title,
         datetime(s.time_created/1000, 'unixepoch', 'localtime') as created,
         p.worktree as project
  FROM session s
  LEFT JOIN project p ON s.project_id = p.id
  WHERE s.parent_id IS NULL
    AND s.time_archived IS NULL
  ORDER BY s.time_updated DESC
  LIMIT 20;
"
```

### Read conversation transcript for a session

```bash
sqlite3 "$DB" "
  SELECT json_extract(m.data, '$.role') as role,
         json_extract(p.data, '$.text') as text
  FROM message m
  JOIN part p ON p.message_id = m.id
  WHERE m.session_id = 'SESSION_ID'
    AND json_extract(p.data, '$.type') = 'text'
  ORDER BY m.time_created ASC, p.id ASC;
"
```

### List tool calls in a session

```bash
sqlite3 "$DB" "
  SELECT json_extract(p.data, '$.tool') as tool,
         json_extract(p.data, '$.state.status') as status,
         json_extract(p.data, '$.state.title') as title
  FROM part p
  JOIN message m ON p.message_id = m.id
  WHERE m.session_id = 'SESSION_ID'
    AND json_extract(p.data, '$.type') = 'tool'
  ORDER BY p.time_created ASC;
"
```

### Token usage and cost per assistant message

```bash
sqlite3 "$DB" "
  SELECT m.id,
         json_extract(m.data, '$.providerID') || '/' || json_extract(m.data, '$.modelID') as model,
         json_extract(m.data, '$.cost') as cost,
         json_extract(m.data, '$.tokens.input') as input_tok,
         json_extract(m.data, '$.tokens.output') as output_tok,
         json_extract(m.data, '$.tokens.reasoning') as reason_tok,
         json_extract(m.data, '$.tokens.cache.read') as cache_read,
         json_extract(m.data, '$.tokens.cache.write') as cache_write
  FROM message m
  WHERE m.session_id = 'SESSION_ID'
    AND json_extract(m.data, '$.role') = 'assistant'
  ORDER BY m.time_created ASC;
"
```

### Total cost for a session

```bash
sqlite3 "$DB" "
  SELECT SUM(json_extract(m.data, '$.cost')) as total_cost
  FROM message m
  WHERE m.session_id = 'SESSION_ID'
    AND json_extract(m.data, '$.role') = 'assistant';
"
```

### Search sessions by title

```bash
sqlite3 "$DB" "
  SELECT s.id, s.title,
         datetime(s.time_updated/1000, 'unixepoch', 'localtime') as updated
  FROM session s
  WHERE s.title LIKE '%SEARCH_TERM%'
    AND s.time_archived IS NULL
  ORDER BY s.time_updated DESC;
"
```

### Cost summary across all sessions for a project

```bash
sqlite3 "$DB" "
  SELECT s.title,
         SUM(json_extract(m.data, '$.cost')) as total_cost,
         COUNT(m.id) as messages
  FROM session s
  JOIN message m ON m.session_id = s.id
  WHERE s.project_id = 'PROJECT_ID'
    AND json_extract(m.data, '$.role') = 'assistant'
    AND s.time_archived IS NULL
  GROUP BY s.id
  ORDER BY total_cost DESC
  LIMIT 20;
"
```

## Notes

- Session IDs start with `ses_` and are descending timestamp-based.
- Message IDs start with `msg_` and are ascending timestamp-based.
- Part IDs start with `prt_` and are ascending timestamp-based.
- The database uses WAL mode; it is safe to query while OpenCode is
  running.
- Archived sessions have a non-NULL `time_archived` column.
- Child/forked sessions have a non-NULL `parent_id`; filter with
  `parent_id IS NULL` for root sessions only.
