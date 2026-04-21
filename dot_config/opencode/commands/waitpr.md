---
description: Wait for a PR to get a new review, CI failure, or merge
---

The argument is an optional PR URL. If not provided, use `gh pr view
--json url` on the current branch.

Detect the PR type from the URL:

- **GitHub** (`github.com`): use `gh` commands as described below.
- **GitLab** (`gitlab.com`): use `glab` commands as described below.
- **Pagure** (`src.fedoraproject.org`): use the Pagure REST API as
  described below.

Poll every 30 seconds (with a 20 minute timeout) until one of these
conditions is met:

1. The PR is merged
2. Any CI check has failed
3. All CI checks have passed
4. (GitHub/GitLab) The number of reviews/approvals has increased

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

## GitLab

Use `glab mr view <URL> --output json` to get MR details in a single
call. Extract `project_id`, `iid`, `state`, and `head_pipeline` from
the JSON. Record the initial approval count using
`glab api projects/{project_id}/merge_requests/{iid}/approvals` and
inspect the `approved_by` array length.

Check for merge: inspect the `state` field from `glab mr view`
(`merged`, `closed`, `opened`).

Check CI: inspect `head_pipeline.status` from the MR JSON. Possible
values include `running`, `pending`, `success`, `failed`, `canceled`.
If the pipeline status is `running`, also fetch individual job
statuses via
`glab api projects/{project_id}/pipelines/{pipeline_id}/jobs` and
check if any job has `status` = `failed` (the pipeline-level status
only changes to `failed` after all jobs finish, but individual jobs
can fail earlier). If the pipeline has failed (or any job has failed),
report which jobs failed with their `web_url`.

Check reviews: compare the current `approved_by` array length from the
approvals API to the initial count. If it increased, fetch and display
the new approval details.

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
