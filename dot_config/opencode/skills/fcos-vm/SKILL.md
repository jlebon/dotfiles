---
name: fcos-vm
description: Bring up a Fedora CoreOS VM using QEMU.
---

# Fedora CoreOS VM Skill

Provision Fedora CoreOS VMs for testing or running commands in an isolated environment.

## Prerequisites

Requires: `coreos-installer`, `butane`, `ignition-validate`, `qemu-system-x86_64`, SSH key pair.

## Step-by-Step Instructions

### 1. Setup Working Directory

```bash
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

### 5. Launch VM with QEMU

```bash
VCPUS=$(($(nproc) < 16 ? $(nproc) : 16))
qemu-system-x86_64 -m 4096 -smp $VCPUS -cpu host -enable-kvm -nographic -snapshot \
  -drive "if=virtio,file=${IMAGE}" \
  -fw_cfg "name=opt/com.coreos/config,file=${PWD}/config.ign" \
  -nic user,model=virtio,hostfwd=tcp::2222-:22 &
echo $! > qemu.pid
```

### 6. Wait for VM to Boot

```bash
echo "Waiting for SSH..."
for i in {1..60}; do
  if ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
       -i ~/.ssh/id_ed25519 -p 2222 core@localhost true 2>/dev/null; then
    echo "SSH ready after ~$((i*2)) seconds"
    break
  fi
  sleep 2
done
```

### 7. Run Commands via SSH

```bash
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -i ~/.ssh/id_ed25519 -p 2222 core@localhost "command here"
```

### 8. Stop and Cleanup

```bash
kill $(cat qemu.pid) && rm -rf ~/fcos-vm
```

## Share Directory with VM (virtiofs)

```bash
SHARE_DIR="/path/to/share"
SOCKET_PATH="${PWD}/virtiofsd.sock"

/usr/libexec/virtiofsd --socket-path "$SOCKET_PATH" --shared-dir "$SHARE_DIR" \
  --sandbox none --seccomp none &
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
  -nic user,model=virtio,hostfwd=tcp::2222-:22 &
echo $! > qemu.pid
```

Mount inside VM:

```bash
sudo mkdir -p /mnt/host && sudo mount -t virtiofs hostshare /mnt/host
```

Stop both:

```bash
kill $(cat qemu.pid) $(cat virtiofsd.pid)
```
