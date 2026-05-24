---
description: Create or update AGENTS.md for the current project
argument-hint: "[focus]"
---

Create or update `AGENTS.md` at the root of this repository with compact,
actionable guidance for coding agents working in this codebase.

User-provided focus or constraints (honor these): $ARGUMENTS

## Investigation

Read the highest-value sources first:
- READMEs, root manifests, workspace configs, lockfiles
- Build, test, lint, formatter, typecheck, and codegen configs
- CI workflows and pre-commit / task runner configs
- Existing instruction files (`AGENTS.md`, `.pi/agent/AGENTS.md`, `CLAUDE.md`,
  `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`)

If architecture is still unclear, inspect a small number of representative
source files to find entrypoints, package boundaries, and execution flow.

Trust executable sources of truth (configs, scripts) over prose when they
conflict.

## What to include

Every line should answer: "Would an agent likely get this wrong without help?"

- Exact developer commands, especially non-obvious ones
- How to run a single test or focused verification step
- Required command ordering when it matters
- Monorepo boundaries, major directory ownership, real entrypoints
- Framework/toolchain quirks: codegen, migrations, special env loading
- Repo-specific conventions that differ from defaults
- Testing quirks: fixtures, prerequisites, snapshot workflows

## What to exclude

- Generic software advice or language conventions
- Long tutorials or exhaustive file trees
- Speculative claims or anything not verified from the repo
- Content obvious from filenames or standard tooling

## Writing style

Prefer short sections and bullets. Simple repo → simple file.

If `AGENTS.md` already exists, improve it in place: preserve verified guidance,
remove stale content, reconcile with the current codebase.
