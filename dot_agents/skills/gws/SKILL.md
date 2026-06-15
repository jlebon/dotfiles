---
name: gws
description: Interact with Google Workspace APIs using the gws CLI. Use for managing Drive files, Gmail, Calendar events, Sheets, Docs, Chat, Tasks, and cross-service workflows.
---

# gws — Google Workspace CLI

CLI for all Google Workspace APIs. Commands are dynamically generated
from Google's Discovery Service — when Google adds an API endpoint, gws
picks it up automatically.

Source: <https://github.com/googleworkspace/cli>

## Authentication

gws must be authenticated before use. Check status with `gws auth status`.

```bash
# Interactive OAuth (opens browser)
gws auth setup       # one-time: creates GCP project, enables APIs, logs in
gws auth login       # subsequent logins (select scopes)

# Scope-limited login (for unverified/testing apps, max ~25 scopes)
gws auth login -s drive,gmail,calendar

# Pre-obtained token (e.g. from gcloud)
export GOOGLE_WORKSPACE_CLI_TOKEN=$(gcloud auth print-access-token)

# Service account
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/service-account.json
```

Auth precedence: `GOOGLE_WORKSPACE_CLI_TOKEN` > `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` > encrypted credentials (`gws auth login`) > plaintext credentials file.

## CLI Syntax

```bash
gws <service> <resource> [sub-resource] <method> [flags]
```

### Global Flags

| Flag | Description |
|------|-------------|
| `--params '<JSON>'` | URL/query parameters |
| `--json '<JSON>'` | Request body (POST/PATCH/PUT) |
| `--upload <PATH>` | Upload file content (multipart) |
| `-o, --output <PATH>` | Save binary responses to file |
| `--format <FMT>` | Output format: `json` (default), `table`, `yaml`, `csv` |
| `--dry-run` | Validate without calling the API |
| `--page-all` | Auto-paginate (NDJSON output) |
| `--page-limit <N>` | Max pages (default: 10) |
| `--page-delay <MS>` | Delay between pages in ms (default: 100) |
| `--sanitize <TEMPLATE>` | Screen responses through Model Armor |

### Services

| Service | Aliases | Description |
|---------|---------|-------------|
| `drive` | | Manage files, folders, shared drives |
| `gmail` | | Send, read, manage email |
| `calendar` | | Manage calendars and events |
| `sheets` | | Read and write spreadsheets |
| `docs` | | Read and write Google Docs |
| `slides` | | Read and write presentations |
| `chat` | | Manage Chat spaces and messages |
| `tasks` | | Manage task lists and tasks |
| `people` | | Manage contacts and profiles |
| `forms` | | Read and write Google Forms |
| `keep` | | Manage Google Keep notes |
| `meet` | | Manage Google Meet conferences |
| `classroom` | | Manage classes, rosters, and coursework |
| `admin-reports` | `reports` | Audit logs and usage reports |
| `events` | | Subscribe to Workspace events |
| `workflow` | `wf` | Cross-service productivity workflows |
| `script` | | Manage Google Apps Script projects |
| `modelarmor` | | Filter content for safety |

## Discovering Commands

Use `--help` at any level to see available resources and methods:

```bash
gws drive --help               # list drive resources and helpers
gws drive files --help         # list methods on drive.files
gws drive files list --help    # flags for drive.files.list
```

Introspect method schemas:

```bash
gws schema drive.files.list              # request/response schema
gws schema drive.files.list --resolve-refs  # expand $ref types inline
```

## Drive

```bash
# List files
gws drive files list --params '{"pageSize": 10}'

# Search files
gws drive files list --params '{"q": "name contains '\''report'\''", "pageSize": 5}'

# Get file metadata
gws drive files get --params '{"fileId": "FILE_ID"}'

# Download file content
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' -o output.pdf

# Upload a file (helper)
gws drive +upload ./report.pdf
gws drive +upload ./report.pdf --parent FOLDER_ID --name "Q1 Report"

# Upload with raw API (multipart)
gws drive files create --json '{"name": "data.csv"}' --upload ./data.csv

# Create a folder
gws drive files create --json '{"name": "My Folder", "mimeType": "application/vnd.google-apps.folder"}'

# Move a file (update parents)
gws drive files update --params '{"fileId": "FILE_ID", "addParents": "FOLDER_ID", "removeParents": "OLD_FOLDER_ID"}' --json '{}'

# Delete a file
gws drive files delete --params '{"fileId": "FILE_ID"}'

# List permissions
gws drive permissions list --params '{"fileId": "FILE_ID"}'

# Share a file
gws drive permissions create --params '{"fileId": "FILE_ID"}' --json '{"role": "reader", "type": "user", "emailAddress": "user@example.com"}'

# Paginate all files
gws drive files list --params '{"pageSize": 100}' --page-all | jq -r '.files[].name'
```

## Gmail

```bash
# Send email (helper — handles MIME encoding)
gws gmail +send --to alice@example.com --subject "Hello" --body "Hi there"
gws gmail +send --to alice@example.com --subject "Report" --body "See attached" -a report.pdf
gws gmail +send --to a@ex.com --subject "Hi" --body "<b>Bold</b>" --html
gws gmail +send --to a@ex.com --subject "Draft" --body "Save this" --draft

# Reply / reply-all / forward
gws gmail +reply --message-id MSG_ID --body "Thanks!"
gws gmail +reply-all --message-id MSG_ID --body "Noted."
gws gmail +forward --message-id MSG_ID --to bob@example.com

# Triage inbox (read-only summary)
gws gmail +triage
gws gmail +triage --max 5 --query 'from:boss'
gws gmail +triage --format table

# Read a message
gws gmail +read --message-id MSG_ID

# Watch for new emails (streaming NDJSON)
gws gmail +watch --project PROJECT_ID

# List messages (raw API)
gws gmail users messages list --params '{"userId": "me", "maxResults": 5}'

# Get message
gws gmail users messages get --params '{"userId": "me", "id": "MSG_ID"}'

# List labels
gws gmail users labels list --params '{"userId": "me"}'
```

## Calendar

```bash
# Show agenda (helper — uses account timezone)
gws calendar +agenda
gws calendar +agenda --today
gws calendar +agenda --tomorrow
gws calendar +agenda --week
gws calendar +agenda --days 3 --calendar 'Work'
gws calendar +agenda --today --timezone America/New_York

# Create event (helper)
gws calendar +insert --summary 'Standup' \
  --start '2026-06-17T09:00:00-07:00' --end '2026-06-17T09:30:00-07:00'
gws calendar +insert --summary 'Review' \
  --start '2026-06-17T14:00:00Z' --end '2026-06-17T15:00:00Z' \
  --attendee alice@example.com --meet

# List events (raw API)
gws calendar events list --params '{"calendarId": "primary", "maxResults": 10, "timeMin": "2026-06-01T00:00:00Z", "singleEvents": true, "orderBy": "startTime"}'

# Delete event
gws calendar events delete --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'
```

## Sheets

```bash
# Read values (helper)
gws sheets +read --spreadsheet SPREADSHEET_ID --range "Sheet1!A1:D10"

# Append row (helper)
gws sheets +append --spreadsheet SPREADSHEET_ID --values 'Alice,95,true'
gws sheets +append --spreadsheet SPREADSHEET_ID --json-values '[["a","b"],["c","d"]]'
gws sheets +append --spreadsheet SPREADSHEET_ID --range "Sheet2!A1" --values 'Alice,100'

# Create spreadsheet (raw API)
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget"}}'

# Get spreadsheet metadata
gws sheets spreadsheets get --params '{"spreadsheetId": "SPREADSHEET_ID"}'

# Read values (raw API)
gws sheets spreadsheets values get --params '{"spreadsheetId": "ID", "range": "Sheet1!A1:C10"}'

# Update values (raw API)
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95]]}'
```

## Docs

```bash
# Export document as plain text (best for reading content)
gws drive files export --params '{"fileId": "DOC_ID", "mimeType": "text/plain"}' -o doc.txt

# Export as HTML (verbose Google CSS, but preserves formatting)
gws drive files export --params '{"fileId": "DOC_ID", "mimeType": "text/html"}' -o doc.html

# Get document structure as JSON
gws docs documents get --params '{"documentId": "DOC_ID"}'

# Append text (helper)
gws docs +write --document DOC_ID --text 'Hello, world!'

# Create document
gws docs documents create --json '{"title": "Meeting Notes"}'
```

## Slides

```bash
# Export presentation as plain text (best for reading content)
gws drive files export --params '{"fileId": "PRESENTATION_ID", "mimeType": "text/plain"}' -o slides.txt

# Get presentation structure as JSON
gws slides presentations get --params '{"presentationId": "PRESENTATION_ID"}'
```

## Chat

```bash
# Send message (helper)
gws chat +send --space spaces/AAAAxxxx --text 'Hello team!'

# List spaces
gws chat spaces list

# List messages
gws chat spaces messages list --params '{"parent": "spaces/SPACE_ID"}'

# Create message (raw API)
gws chat spaces messages create \
  --params '{"parent": "spaces/SPACE_ID"}' \
  --json '{"text": "Deploy complete."}'
```

## Tasks

```bash
# List task lists
gws tasks tasklists list

# List tasks
gws tasks tasks list --params '{"tasklist": "TASKLIST_ID"}'

# Create task
gws tasks tasks insert --params '{"tasklist": "TASKLIST_ID"}' \
  --json '{"title": "Review PR", "notes": "Check test coverage"}'
```

## Cross-Service Workflows

```bash
# Morning standup: today's meetings + open tasks
gws workflow +standup-report

# Prepare for next meeting: agenda, attendees, linked docs
gws workflow +meeting-prep

# Convert email to task
gws workflow +email-to-task --message-id MSG_ID

# Weekly digest: meetings + unread count
gws workflow +weekly-digest

# Announce Drive file in Chat
gws workflow +file-announce --file-id FILE_ID --space spaces/SPACE_ID
```

## Other Services

```bash
# Apps Script — push local files to a project
gws script +push --script-id SCRIPT_ID --dir ./src

# Workspace Events — subscribe and stream
gws events +subscribe --target '//docs.googleapis.com/documents/DOC_ID' \
  --event-types 'google.workspace.document.revision.created' --project PROJECT_ID

# People — list connections
gws people people connections list --params '{"resourceName": "people/me", "personFields": "names,emailAddresses"}'

# Forms — get form
gws forms forms get --params '{"formId": "FORM_ID"}'
```

## Shell Tips

- **Sheets `!` in ranges**: zsh interprets `!` as history expansion.
  Use double quotes: `--range "Sheet1!A1:D10"`
- **JSON with double quotes**: wrap `--params` and `--json` in single
  quotes so the shell preserves inner double quotes:
  `--params '{"pageSize": 5}'`
- **Nested single quotes**: use `'\''` to embed a literal single quote
  inside a single-quoted string.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | API error (Google returned 4xx/5xx) |
| 2 | Auth error (credentials missing/expired) |
| 3 | Validation error (bad arguments) |
| 4 | Discovery error (could not fetch schema) |
| 5 | Internal error |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_WORKSPACE_CLI_TOKEN` | Pre-obtained OAuth2 access token |
| `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` | Path to OAuth credentials JSON |
| `GOOGLE_WORKSPACE_CLI_CLIENT_ID` | OAuth client ID |
| `GOOGLE_WORKSPACE_CLI_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` | Config dir (default: `~/.config/gws`) |
| `GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND` | `keyring` (default) or `file` |
| `GOOGLE_WORKSPACE_PROJECT_ID` | GCP project ID for quota/billing |

## Tips

- All output is structured JSON by default — pipe to `jq` for
  filtering.
- Use `--dry-run` to preview requests before executing, especially for
  write/delete operations.
- Use `--page-all` to auto-paginate large result sets (outputs NDJSON).
- Helper commands (prefixed with `+`) provide ergonomic shortcuts for
  common multi-step operations. Use raw API commands for anything
  helpers don't cover.
- Run `gws <service> --help` to see both Discovery methods and helpers.
