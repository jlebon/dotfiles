---
description: Wait for a PR to get a new review, CI failure, or merge
---

Find the PR number for the current branch using `gh pr view --json number`.
Then record the current number of reviews using `gh api repos/{owner}/{repo}/pulls/{number}/reviews --jq length`.

Poll every 30 seconds (with a 20 minute timeout) until one of these conditions is met:

1. The PR state is `MERGED`
2. Any CI check has conclusion `FAILURE` or `TIMED_OUT`
3. The number of reviews has increased

When a condition is met, report what happened. If it was a new review, fetch and display the review details and any inline comments. If it was a CI failure, show which checks failed.
