---
name: rhjira
description: Manage Red Hat Jira tickets using the rhjira CLI (create, edit, show, close, list, clone, comment).
---

# rhjira

CLI tool for managing tickets on Red Hat's Jira instance
(`https://redhat.atlassian.net`). Source:
<https://gitlab.com/prarit/rhjira-python>

## Authentication

rhjira must be authenticated before use. Run `rhjira settoken` to
interactively configure credentials (stored in the system keyring).
Alternatively, set environment variables (these override keyring values):

- `JIRA_TOKEN` - Jira API token (required)
- `JIRA_EMAIL` - email for Atlassian Cloud auth
- `JIRA_SERVER` - server URL (default: `https://redhat.atlassian.net`)

## Commands

### Show a ticket

```bash
rhjira show TICKET-123
rhjira show --nocomments TICKET-123
```

Displays summary, description, status, assignee, links (epic, parent,
blocks, blocked by, children), and comments.

### Create a ticket

```bash
# Minimal (opens editor for remaining fields):
rhjira create --project RHEL --tickettype Bug --summary "Title"

# Non-interactive:
rhjira create --project RHEL --tickettype Bug \
  --summary "Title" --description "Details" \
  --components "kernel" --assignee "user@redhat.com" \
  --severity Urgent --priority Critical \
  --noeditor

# From a template file:
rhjira create -T template-file --noeditor
```

Other create options: `--affectsversion`, `--contributors`,
`--epiclink`, `--epicname`, `--fixversion`, `--parentlink`,
`--releaseblocker`, `--securitylevel`, `--isblockedby`, `--blocks`,
`--sprint`.

Without `--noeditor`, rhjira opens `$GIT_EDITOR` / `$EDITOR` / `vi`
with a pre-populated template. Lines starting with `#` are comments. On
failure, the template is saved to `/tmp/rhjira.<timestamp>` for retry.

### Edit a ticket

```bash
# Interactive (opens editor with current values):
rhjira edit TICKET-123

# Non-interactive field updates:
rhjira edit --status "In Progress" --noeditor TICKET-123
rhjira edit --assignee "user@redhat.com" --noeditor TICKET-123
rhjira edit --summary "New title" --description "New desc" --noeditor TICKET-123
rhjira edit --severity Urgent --priority Critical --noeditor TICKET-123
rhjira edit --components "kernel" --fixversion "9.6" --noeditor TICKET-123
rhjira edit --isblockedby OTHER-456 --noeditor TICKET-123
rhjira edit --blocks OTHER-789 --noeditor TICKET-123
rhjira edit --sprint "Sprint 42" --noeditor TICKET-123
```

Other edit options: `--affectsversion`, `--contributors`, `--epiclink`,
`--epicname`, `--gitpullrequest`, `--parentlink`, `--releaseblocker`,
`--resolution`, `--securitylevel`, `--summarystatus`.

### Close a ticket

```bash
rhjira close TICKET-123
rhjira close --resolution "Won't Do" TICKET-123
```

`close` is an alias for `edit --close`. Default resolution is "Done".

### List tickets (JQL search)

```bash
rhjira list "project = RHEL AND status = Open"
rhjira list --numentries 50 "assignee = currentUser() AND status != Closed"
rhjira list --fields versions,summary "project = RHEL"
rhjira list --rawoutput "project = RHEL"   # pipe-delimited, for scripting
rhjira list --textonly "project = RHEL"    # no terminal hyperlinks
rhjira list --noheader --nolinenumber "project = RHEL"
```

Human-readable field names in JQL queries (e.g. `severity`,
`releaseblocker`) are automatically resolved to their custom field IDs.

### Comment on a ticket

```bash
rhjira comment TICKET-123                  # opens editor
rhjira comment --noeditor TICKET-123       # reads from stdin
rhjira comment -f comment.txt TICKET-123   # from file
```

### Clone a ticket

```bash
rhjira clone TICKET-123
rhjira clone TICKET-123 --project NEWPROJ --tickettype Story
rhjira clone TICKET-123 --with-comments --with-attachments
rhjira clone TICKET-123 --summary "New title" --assignee "user@redhat.com"
```

Other clone options: `--description`, `--components`, `--labels`,
`--priority`.

### Dump ticket fields (debugging)

```bash
rhjira dump TICKET-123
rhjira dump --json TICKET-123
rhjira dump --fields summary,status TICKET-123
rhjira dump --showcustomfields --showemptyfields TICKET-123
```

Shows raw field names and values. Useful for finding custom field IDs.

### View ticket hierarchy

```bash
rhjira hierarchy TICKET-123
rhjira hierarchy --expand TICKET-123   # follow blocking issues too
```

Displays the parent-child and blocking relationship tree.

### Project info

```bash
rhjira info --project RHEL components
rhjira info --project RHEL versions
rhjira info --project RHEL sprints
rhjira info --project RHEL resolutions
rhjira info --project RHEL securitylevels
```

## Tips

- Use `--noeditor` for scripting/automation.
- All commands support `--help` for full option listing.
- The `--rawoutput` flag on `list` produces pipe-delimited output
  suitable for parsing with `cut`, `awk`, etc.
- `rhjira dump --json` is useful for inspecting the raw API response.
