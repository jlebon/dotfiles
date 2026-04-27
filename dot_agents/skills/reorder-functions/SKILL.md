---
name: reorder-functions
description: Reorder functions in canonical order: public functions by data flow (constructor first, cleanup last), then private functions in depth-first call order.
---

# Reorder Functions in Canonical Order

## Overview

This skill reorders functions in a file to follow a canonical ordering that
improves readability by reflecting the natural lifecycle and data flow.

## Canonical Order

### 1. Public Functions (by data flow)

Order public functions to reflect the natural lifecycle:

1. **Constructors/Initialization** - `new`, `init`, `create`, `build`, factory functions
2. **Core Operations** - main functionality in logical data-flow order
3. **Cleanup/Teardown** - `drop`, `close`, `destroy`, `cleanup`, `free`, destructors

### 2. Private Functions (by first call)

Order private functions by when they first appear in the call tree:

1. Walk each public function's call tree in depth-first order
2. Place each private function where it's first encountered
3. Private functions never called go at the very end

## Algorithm

1. **Identify visibility** - Determine which functions are public vs private
   - Rust: `pub`, `pub(crate)`, `pub(super)` = public; no modifier = private
   - TypeScript/JavaScript: `export` = public; no export = private
   - Python: no leading underscore = public; `_name` = private
   - Go: uppercase first letter = public; lowercase = private

2. **Order public functions** - Group by lifecycle phase:
   - Scan for constructor patterns -> place first
   - Scan for cleanup patterns -> place last
   - Remaining public functions stay in relative order between these

3. **Build call graph** - For each public function, trace which private
   functions it calls (and which private functions those call, recursively)

4. **Order private functions** - Walk public functions in order; for each,
   do a depth-first traversal of its calls. Record each private function
   at its first encounter.

5. **Append uncalled** - Any private functions not reached go at the end
   (these may be dead code worth reviewing)

## Edge Cases

- **Recursive calls**: A function calling itself doesn't affect ordering
- **Mutual recursion**: The function encountered first wins
- **Multiple callers**: First encounter across all public functions wins
- **Uncalled private functions**: Placed at the end; consider if they're dead code

## Example

Before:

```text
fn cleanup() { ... }           // public, cleanup
fn helper_b() { ... }          // private
fn process() { helper_a(); }   // public, core
fn new() { ... }               // public, constructor
fn helper_a() { helper_b(); }  // private
```

After:

```text
fn new() { ... }               // public: constructor first
fn process() { helper_a(); }   // public: core operations
fn cleanup() { ... }           // public: cleanup last
fn helper_a() { helper_b(); }  // private: called by process()
fn helper_b() { ... }          // private: called by helper_a()
```
