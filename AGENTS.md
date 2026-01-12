# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Overview

This is a personal dotfiles repository managed by [chezmoi](https://www.chezmoi.io/). Chezmoi uses special file naming conventions to track dotfiles.

## Chezmoi File Naming

Files in this repo map to home directory locations:
- `dot_` prefix → `.` (e.g., `dot_gitconfig` → `~/.gitconfig`)
- `executable_` prefix → file will be executable
- `symlink_` prefix → creates a symlink
- Files in `dot_local/bin/` → `~/.local/bin/`
- Files in `dot_bashrc.d/` → `~/.bashrc.d/` (sourced by bashrc)
- Files in `dot_config/` → `~/.config/`

## Structure

- `dot_local/bin/` - Shell scripts and wrappers (git helpers, container wrappers, tmux utilities)
- `dot_bashrc.d/` - Bash utilities sourced on shell startup (numbered for load order)
- `dot_config/helix/` - Helix editor configuration
- `dot_gitconfig` - Git configuration with many aliases
- `dot_tmux.conf` - tmux configuration

## Key Scripts

- `executable_xclaude` - Runs Claude Code in an unprivileged container
- `executable_git-*` - Git workflow helpers (branch management, PR handling, interactive log)
- Container wrappers (`executable_podman`, `executable_buildah`, `executable_skopeo`) - Proxy to host via `host-spawn`
