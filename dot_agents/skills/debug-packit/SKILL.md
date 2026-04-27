---
name: debug-packit
description: Debug Packit COPR build failures by retrieving logs.
---

# Debug Packit

Debug Packit COPR build failures by retrieving logs from the Packit and
COPR APIs.

## Steps

1. **Find the SRPM build ID** from the GitHub check run:

   ```bash
   gh api repos/OWNER/REPO/commits/$(gh pr view PR --json headRefOid -q .headRefOid)/check-runs \
     --jq '.check_runs[] | select(.name | test("rpm-build")) | {name, conclusion, details_url}'
   ```

   The `details_url` contains the SRPM build ID (e.g.
   `https://dashboard.packit.dev/jobs/srpm/561705` → ID `561705`).

2. **Get the COPR build log URL** from the Packit API:

   ```bash
   curl -sL "https://prod.packit.dev/api/srpm-builds/SRPM_BUILD_ID" | python3 -m json.tool
   ```

   Look for the `logs_url` field, which points to the COPR builder log.

3. **Fetch and read the builder log** (it's gzipped):

   ```bash
   curl -sL "LOG_URL.gz" | gunzip | tail -80
   ```

   If the log URL doesn't end in `.gz`, check the COPR build directory
   listing for available log files:

   ```bash
   curl -sL "https://download.copr.fedorainfracloud.org/results/OWNER/PROJECT/srpm-builds/COPR_BUILD_ID/"
   ```

4. **Search for errors** in the log:

   ```bash
   curl -sL "LOG_URL.gz" | gunzip | grep -A20 "ERROR\|error:\|failed\|Command.*failed"
   ```

## Notes

- The Packit dashboard (`dashboard.packit.dev`) may not be accessible
  from all environments. Use the API at `prod.packit.dev/api/` instead.
- COPR builder logs are compressed with gzip after the build finishes.
- The `backend.log.gz` in the same directory contains infrastructure
  logs (VM allocation, rsync). The `builder-live.log.gz` contains the
  actual build output.
