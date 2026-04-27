---
name: fcos-kola-test
description: Build a custom Fedora CoreOS image with patches and run kola tests.
---

# Custom FCOS Build and Kola Test Skill

Build a Fedora CoreOS image with custom rpm-ostree binary, config files, or other
patches, then run kola integration tests against it.

## Prerequisites

- coreos-assembler (cosa) container image: `quay.io/coreos-assembler/coreos-assembler:latest`
- fedora-coreos-config repo cloned locally
- Patches to inject (rpm-ostree binary, config files, etc.)

## Directory Setup

Create a working directory for the build:

```bash
mkdir -p /tmp/fcos-build
```

## Step 1: Clone fedora-coreos-config (if needed)

```bash
git clone https://github.com/coreos/fedora-coreos-config ~/Code/github.com/coreos/fedora-coreos-config
cd ~/Code/github.com/coreos/fedora-coreos-config
git checkout testing-devel
```

## Step 2: Inject Custom Files

Copy files to inject into the FCOS config directory:

```bash
# Example: custom rpm-ostree binary
cp /path/to/rpm-ostree ~/Code/github.com/coreos/fedora-coreos-config/

# Example: custom tmpfiles.d config
cp /path/to/rpm-ostree-0-integration.conf ~/Code/github.com/coreos/fedora-coreos-config/

# Example: custom finalize script
cp /path/to/01-var.sh ~/Code/github.com/coreos/fedora-coreos-config/
```

## Step 3: Modify Containerfile

Edit the Containerfile to COPY custom files. Add after the existing COPY comments:

```dockerfile
# useful if you're hacking on rpm-ostree/bootc-base-imagectl
COPY rpm-ostree /usr/bin/
COPY rpm-ostree-0-integration.conf /usr/lib/tmpfiles.d/
COPY 01-var.sh /usr/share/doc/bootc-base-imagectl/manifests/minimal/finalize.d/01-var.sh
```

If injecting into target rootfs (for files that need to be in the final image,
not just used during compose), add a RUN step after `build-rootfs`:

```dockerfile
RUN cp /usr/lib/tmpfiles.d/rpm-ostree-0-integration.conf /target-rootfs/usr/lib/tmpfiles.d/
```

## Step 4: Update .containerignore

Add entries to allow the custom files:

```
!/rpm-ostree
!/rpm-ostree-0-integration.conf
!/01-var.sh
```

## Step 5: Initialize cosa Workdir

```bash
cd /tmp/fcos-build
podman run --rm -it --security-opt label=disable --privileged \
  --uidmap=1000:0:1 --uidmap=0:1:1000 --uidmap 1001:1001:64536 \
  -v /tmp/fcos-build:/srv \
  -v ~/Code/github.com/coreos/fedora-coreos-config:/src/config:ro \
  -w /srv quay.io/coreos-assembler/coreos-assembler:latest \
  init /src/config
```

## Step 6: Build FCOS Image

```bash
cd /tmp/fcos-build
podman run --rm -it --security-opt label=disable --privileged \
  --uidmap=1000:0:1 --uidmap=0:1:1000 --uidmap 1001:1001:64536 \
  -v /tmp/fcos-build:/srv \
  -v ~/Code/github.com/coreos/fedora-coreos-config:/src/config:ro \
  -w /srv quay.io/coreos-assembler/coreos-assembler:latest \
  build
```

The OCI archive will be at: `builds/latest/x86_64/fedora-coreos-*-ostree.x86_64.ociarchive`

## Step 7: Verify Image Contents

Load image and inspect:

```bash
skopeo copy oci-archive:/tmp/fcos-build/builds/latest/x86_64/fedora-coreos-*-ostree.x86_64.ociarchive \
  containers-storage:localhost/test-fcos:latest

# Check a file in the image
podman run --rm localhost/test-fcos:latest cat /usr/lib/tmpfiles.d/rpm-ostree-0-integration.conf
```

## Step 8: Build QEMU Image

```bash
cd /tmp/fcos-build
podman run --rm -it --security-opt label=disable --privileged \
  --uidmap=1000:0:1 --uidmap=0:1:1000 --uidmap 1001:1001:64536 \
  -v /tmp/fcos-build:/srv \
  -v ~/Code/github.com/coreos/fedora-coreos-config:/src/config:ro \
  -w /srv quay.io/coreos-assembler/coreos-assembler:latest \
  buildextend-qemu
```

## Step 9: Build Kola Tests (for rpm-ostree)

If testing rpm-ostree kolainst tests:

```bash
cd /path/to/rpm-ostree/tests/kolainst
make localinstall
```

This creates the test directory at `tests/kola/`.

## Step 10: Run Kola Test

Mount the test directory and run:

```bash
cd /tmp/fcos-build
podman run --rm -it --security-opt label=disable --privileged \
  --uidmap=1000:0:1 --uidmap=0:1:1000 --uidmap 1001:1001:64536 \
  -v /tmp/fcos-build:/srv \
  -v ~/Code/github.com/coreos/fedora-coreos-config:/src/config:ro \
  -v /path/to/rpm-ostree/tests/kola:/usr/lib/coreos-assembler/tests/kola/rpm-ostree:ro \
  -w /srv quay.io/coreos-assembler/coreos-assembler:latest \
  kola run 'ext.rpm-ostree.nondestructive.misc*'
```

Test patterns:
- `ext.rpm-ostree.nondestructive.*` - all nondestructive tests
- `ext.rpm-ostree.destructive.*` - all destructive tests  
- `ext.rpm-ostree.nondestructive.misc*` - specific test file

## Step 11: Check Test Results

View test journal output:

```bash
cat /tmp/fcos-build/tmp/kola/ext.rpm-ostree.nondestructive.misc.sh/*/journal.txt | grep -E "(ok |PASS|FAIL)"
```

## Step 12: Export Artifacts

Copy final artifacts:

```bash
# QEMU image
cp /tmp/fcos-build/builds/latest/x86_64/fedora-coreos-*-qemu.x86_64.qcow2 /destination/

# OCI archive
cp /tmp/fcos-build/builds/latest/x86_64/fedora-coreos-*-ostree.x86_64.ociarchive /destination/

# Load to host podman (via hostexec if in container)
hostexec run skopeo copy oci-archive:/path/to/ociarchive containers-storage:localhost/test-fcos:latest
```

## Cleanup

```bash
rm -rf /tmp/fcos-build
cd ~/Code/github.com/coreos/fedora-coreos-config && git checkout .
```

## Common Issues

### Build cache issues
If builds fail mysteriously, clear the cache:
```bash
rm -rf /tmp/fcos-build/cache
```

### Missing directories
If cosa commands fail with "No such file or directory", ensure tmp/ and builds/ exist:
```bash
mkdir -p /tmp/fcos-build/{tmp,builds}
```

### Containerfile COPY not taking effect
Files COPYed in builder stage don't automatically appear in the final image.
For files needed in the final rootfs, add a RUN step to copy them to `/target-rootfs/`.
