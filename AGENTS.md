# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Overview

This is a personal dotfiles repository managed by [chezmoi](https://www.chezmoi.io/). Chezmoi uses special file naming conventions to track dotfiles.

## Build/Lint/Test Commands

This is a dotfiles repository without a formal build system, CI/CD, or test suite.

### Script Testing

- **Bash syntax check**: `bash -n <script>` (syntax validation only)
- **ShellCheck lint**: `shellcheck <script>` (static analysis for bash scripts)
- **Python syntax check**: `python3 -m py_compile <script>`

## Chezmoi File Naming Conventions

Files in this repo map to home directory locations:
- `dot_` prefix → `.` (e.g., `dot_gitconfig` → `~/.gitconfig`)
- `executable_` prefix → file will be executable
- `symlink_` prefix → creates a symlink (file content is the target path)
- `private_` prefix → sets restricted permissions (mode 0600)
- Files in `dot_local/bin/` → `~/.local/bin/`
- Files in `dot_bashrc.d/` → `~/.bashrc.d/` (sourced by bashrc)
- Files in `dot_config/` → `~/.config/`

## Code Style Guidelines

### Bash Scripts

#### Header and Strict Mode
```bash
#!/bin/bash
set -euo pipefail
shopt -s inherit_errexit  # for complex scripts with subshells
```

#### Error Handling
- Check for git repo: `git rev-parse --is-inside-work-tree 2>/dev/null`
- Print errors to stderr: `echo "ERROR: message" >&2`
- Use `${var:-}` for optional variables to avoid unbound variable errors

#### Variable Quoting and Arrays
- Always quote variables: `"${var}"` not `$var`
- Use `"$@"` for passing arguments through
- Build command arguments in arrays:
```bash
podman_args=()
podman_args+=(-v "${path}:${path}")
command "${podman_args[@]}"
```

#### Functions
- Use lowercase with underscores: `mount_target_symlink()`
- Declare local variables: `local var="value"`

#### Argument Parsing
```bash
usage() { cat <<EOF
Usage: $(basename "$0") [OPTIONS]
EOF
}
while [ $# -gt 0 ]; do
    case "$1" in
        -h) usage; exit 0 ;;
        --) shift; break ;;
        *) args+=("$1"); shift ;;
    esac
done
```

### Python Scripts

#### Structure
```python
#!/usr/bin/python3

def main():
    args = parse_args()
    # main logic

def parse_args():
    parser = argparse.ArgumentParser(prog="git command-name")
    return parser.parse_args()

def fatal(*args):
    print("fatal:", *args, file=sys.stderr)
    sys.stderr.flush()
    sys.exit(1)

if __name__ == "__main__":
    main()
```

#### Imports and Subprocess
Standard library imports only (no external dependencies):
```python
import argparse
import os
import subprocess
import sys
```
- Use `subprocess.check_output()` for capturing output
- Use `subprocess.check_call()` for side-effect commands
- Always specify `encoding='utf-8'` for text output

### Bashrc Utilities (`dot_bashrc.d/`)

- Files are numbered for explicit load order: `00-`, `01-`, `02-`, `20-`
- Use `local` for function-local variables
- No strict mode (these are sourced, not executed)

## Naming Conventions

- Executable scripts: `executable_<name>` (no extension for bash, implicit)
- Git subcommands: `executable_git-<subcommand>` (becomes `git <subcommand>`)
- Tmux helpers: `executable_tmux-<purpose>`
- Symlink aliases: `symlink_<short-name>` pointing to the full script name
