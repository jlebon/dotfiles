---
name: query-bodhi
description: Query Fedora Bodhi for package update status using the REST API.
---

# Query Bodhi

Query the Fedora Bodhi update system for package update status using the
REST API directly via curl. This avoids needing the `bodhi` CLI or host
access.

## Query updates for a package

```bash
curl -s 'https://bodhi.fedoraproject.org/updates/?packages=PACKAGE&rows_per_page=20' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for u in d['updates']:
    builds = ', '.join(b['nvr'] for b in u['builds'])
    print(f'{u[\"status\"]:10s} {u[\"release\"][\"name\"]:10s} {builds}')
"
```

## Filter by release

Add `&releases=F42` (or `F43`, `F44`, etc.) to filter by Fedora release.

## Filter by status

Add `&status=pending`, `&status=testing`, or `&status=stable` to filter
by update status.

## Useful API response fields

Each update object in the `updates` array contains:

- `builds` - list of builds, each with `nvr` (name-version-release)
- `release.name` - e.g. `F42`, `F43`
- `status` - `pending`, `testing`, `stable`, `obsolete`, `unpushed`
- `request` - `testing`, `stable`, or `null`
- `date_submitted` - submission timestamp
- `date_pushed` - when pushed to repos
- `karma` - current karma count
- `title` - update title (usually the NVR)
- `url` - link to the update page

## Poll for updates

To wait for updates to appear (e.g. after a dist-git PR merge), poll
the API in a loop:

```bash
while true; do
  result=$(curl -s 'https://bodhi.fedoraproject.org/updates/?packages=PACKAGE&rows_per_page=20')
  # Check for expected version across releases
  found=$(echo "${result}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for u in d['updates']:
    for b in u['builds']:
        if 'VERSION' in b['nvr']:
            print(f'{u[\"status\"]:10s} {u[\"release\"][\"name\"]:10s} {b[\"nvr\"]}')
")
  echo "$(date '+%H:%M:%S')"
  echo "${found}"
  # Check if all expected releases are present and break when done
  sleep 60
done
```

## Notes

- The Bodhi web UI is at `https://bodhi.fedoraproject.org/updates/`.
- The API base is `https://bodhi.fedoraproject.org/updates/`.
- Rawhide updates typically go straight to `stable`.
- Branched release updates go through `pending` then `testing` then
  `stable`.
