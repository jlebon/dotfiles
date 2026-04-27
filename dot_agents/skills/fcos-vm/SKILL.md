---
name: fcos-vm
description: Bring up a Fedora CoreOS VM using QEMU.
---

# Fedora CoreOS VM Skill

Provision Fedora CoreOS VMs for testing or running commands in an isolated environment.

## Prerequisites

Requires: `butane`, `qemu-system-x86_64`, `/dev/kvm`.

## Step-by-Step Instructions

### 1. Setup Working Directory

Generate an SSH key if one doesn't exist, then set up the working directory:

```bash
if [[ ! -f ~/.ssh/id_ed25519.pub ]]; then
  mkdir -p ~/.ssh && ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
fi
mkdir -p ~/fcos-vm && cd ~/fcos-vm
cp ~/.ssh/id_ed25519.pub ssh-key.pub
```

### 2. Download FCOS Image

```bash
IMAGE_URL=$(curl -s https://builds.coreos.fedoraproject.org/streams/stable.json | \
  jq -r '.architectures.x86_64.artifacts.qemu.formats["qcow2.xz"].disk.location')
IMAGE_XZ=/srv/imgs/$(basename "$IMAGE_URL")
IMAGE=${IMAGE_XZ%.xz}
[[ ! -f "$IMAGE" ]] && curl -L "$IMAGE_URL" | xzcat > "$IMAGE"
```

### 3. Create Butane Config

Create `config.bu`:

```yaml
variant: fcos
version: 1.6.0
passwd:
  users:
    - name: core
      ssh_authorized_keys_local:
        - ssh-key.pub
```

### 4. Convert Butane to Ignition

```bash
butane --strict --files-dir . config.bu > config.ign
```

### 5. Launch VM and Wait for SSH

Launch QEMU and wait for SSH in a **single tool call**. QEMU output is
redirected to a log file to avoid flooding the tool output with boot messages.

```bash
cd ~/fcos-vm
IMAGE=<path from step 2>
VCPUS=$(($(nproc) < 16 ? $(nproc) : 16))
qemu-system-x86_64 -m 4096 -smp $VCPUS -cpu host -enable-kvm -nographic -snapshot \
  -drive "if=virtio,file=${IMAGE}" \
  -fw_cfg "name=opt/com.coreos/config,file=${PWD}/config.ign" \
  -nic user,model=virtio,hostfwd=tcp::2222-:22 \
  > qemu-console.log 2>&1 &
echo $! > qemu.pid

echo "Waiting for SSH..."
for i in {1..90}; do
  if ! kill -0 $(cat qemu.pid) 2>/dev/null; then
    echo "QEMU died unexpectedly; last 20 lines of console:"
    tail -20 qemu-console.log
    break
  fi
  if ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
       -i ~/.ssh/id_ed25519 -p 2222 core@localhost true 2>/dev/null; then
    echo "SSH ready after ~$((i*2)) seconds"
    break
  fi
  sleep 2
done
```

### 6. Run Commands via SSH

```bash
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -i ~/.ssh/id_ed25519 -p 2222 core@localhost "command here"
```

### 7. Stop and Cleanup

```bash
kill $(cat qemu.pid) && rm -rf ~/fcos-vm
```

## Share Directory with VM (virtiofs)

To share a host directory, replace step 5 with the following. This starts
virtiofsd, then launches QEMU with virtiofs support, and waits for SSH.

```bash
cd ~/fcos-vm
IMAGE=<path from step 2>
SHARE_DIR="/path/to/share"
SOCKET_PATH="${PWD}/virtiofsd.sock"

/usr/libexec/virtiofsd --socket-path "$SOCKET_PATH" --shared-dir "$SHARE_DIR" \
  --sandbox none --seccomp none > virtiofsd.log 2>&1 &
echo $! > virtiofsd.pid
sleep 1

VCPUS=$(($(nproc) < 16 ? $(nproc) : 16))
qemu-system-x86_64 -m 4096 -smp $VCPUS -cpu host -enable-kvm -nographic -snapshot \
  -object memory-backend-memfd,id=mem,size=4096M,share=on \
  -numa node,memdev=mem \
  -chardev socket,id=char0,path="$SOCKET_PATH" \
  -device vhost-user-fs-pci,queue-size=1024,chardev=char0,tag=hostshare \
  -drive "if=virtio,file=${IMAGE}" \
  -fw_cfg "name=opt/com.coreos/config,file=${PWD}/config.ign" \
  -nic user,model=virtio,hostfwd=tcp::2222-:22 \
  > qemu-console.log 2>&1 &
echo $! > qemu.pid

echo "Waiting for SSH..."
for i in {1..90}; do
  if ! kill -0 $(cat qemu.pid) 2>/dev/null; then
    echo "QEMU died unexpectedly; last 20 lines of console:"
    tail -20 qemu-console.log
    break
  fi
  if ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
       -i ~/.ssh/id_ed25519 -p 2222 core@localhost true 2>/dev/null; then
    echo "SSH ready after ~$((i*2)) seconds"
    break
  fi
  sleep 2
done
```

Mount inside VM:

```bash
sudo mkdir -p /mnt/host && sudo mount -t virtiofs hostshare /mnt/host
```

Stop both:

```bash
kill $(cat qemu.pid) $(cat virtiofsd.pid)
```
