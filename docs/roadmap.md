# Roadmap

This roadmap reflects planned work items already referenced in repository documentation and discussions.

It is not a guarantee of delivery order.

## Current baseline (implemented)

- Debugger-backed memory reads via DAP (`readMemory`)
- Virtualized memory grid with hex + decoded rendering
- Memory presets persisted in workspace state
- Register panel with custom register sets and output formatting
- Workspace-scoped view state persistence with deferred last-target restore

## Planned enhancements

### 1) View/session persistence improvements

Status: implemented

- Persist UI state across reloads/reopen flows
- Restore the last target automatically when a stopped session is available
- Preserve layout and register panel preferences per workspace

### 2) Byte-change highlighting improvements

Status: planned

- Refine changed-byte tracking across run/stop cycles
- Improve presentation and clarity of change states

### 3) Call stack integration

Status: planned

- Improve frame-aware workflows in memory/register inspection
- Better integration with active stack/frame context

### 4) Hex/decoded cross-highlighting

Status: planned

- Select a hex cell and highlight corresponding decoded cell (and vice versa)
- Improve byte-to-byte visual mapping

### 5) UX parity ideas inspired by existing memory viewers

Status: exploratory

- Evaluate interaction patterns from tools such as `mcu-debug/memview`
- Adapt useful patterns to current StackScope architecture

## Out of current scope (not implemented)

- Register write-back/editing in the debugger
- Full call-stack pane replacement
- Persistent global (cross-workspace) presets/sets
