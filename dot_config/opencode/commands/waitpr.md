---
description: Wait for a PR to get a new review, CI failure, or merge
---

The argument is an optional PR URL. If not provided, use `gh pr view
--json url` on the current branch.

Detect the PR type from the URL:

- **GitHub** (`github.com`): use `gh` commands as described below.
- **Pagure** (`src.fedoraproject.org`): use the Pagure REST API as
  described below.

Poll every 30 seconds (with a 20 minute timeout) until one of these
conditions is met:

1. The PR is merged
2. Any CI check has failed
3. All CI checks have passed
4. (GitHub only) The number of reviews has increased

When a condition is met, report what happened concisely. If it was a
CI failure, show which checks failed and link to their logs.

## GitHub

Find the PR number using `gh pr view --json number`. Record the current
number of reviews using
`gh api repos/{owner}/{repo}/pulls/{number}/reviews --jq length`.

Check for merge via `gh pr view --json state`. Check CI via
`gh pr checks`. Check reviews via the reviews API (compare count to
initial).

If a new review is found, fetch and display the review details and any
inline comments.

## Pagure

Parse the project path and PR ID from the URL (e.g.
`src.fedoraproject.org/rpms/chunkah/pull-request/9` gives namespace
`rpms/chunkah` and PR ID `9`).

Check for merge via:
`curl -s https://src.fedoraproject.org/api/0/{namespace}/pull-request/{id}`
and inspect the `status` field (`Open`, `Merged`, `Closed`).

Check CI flags via:
`curl -s https://src.fedoraproject.org/api/0/{namespace}/pull-request/{id}/flag`
and inspect each flag's `status` field (`success`, `pending`,
`failure`, `error`).

IMPORTANT: CI flags are at the `/flag` sub-endpoint, NOT inline in the
PR object.
