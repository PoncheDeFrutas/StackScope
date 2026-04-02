# StackScope

StackScope is a VS Code extension for debugger-backed memory inspection.

It is a clean-room implementation inspired by ideas from memory-inspection tools (such as `mcu-debug/memview`), but it is **not** a fork.

Current focus: stable first version for interactive memory and register workflows during paused debug sessions.

## Features

### Memory View

- Open memory by literal address, register, or expression (examples: `0x20000000`, `$sp`, `&myVar`).
- Virtualized memory grid for large ranges with smooth incremental loading.
- Toolbar shortcuts for `PC`, `SP`, and `LR`.
- View presets (built-in + user) stored per workspace.
- Safe behavior on unreadable bytes (shows placeholders instead of hard failure).

### Register Panel

- Read-only register table integrated in the panel.
- Register sets with built-in `Core` set (`$pc`, `$sp`, `$lr`) and custom user sets.
- Visual row-by-row register set editor (add/remove/reorder rows).
- Output format selector for register values: `hex`, `dec`, `oct`, `bin`, `raw`.
- Silent refresh behavior (no disruptive loading flicker), with stale visual hint while target runs.

### Memory Display Settings (in-panel)

- Columns: `1`, `4`, `8`, `16`, `32`
- Unit size: `1`, `2`, `4`, `8`, `16` bytes
- Endianness: `little`, `big`
- Number format: `hex`, `dec`, `oct`, `bin`
- Decoded column mode: `ascii`, `uint8`, `int8`, `bin`, `hidden`
- Total memory size: from `256 B` to `16 MB`

## Requirements

- VS Code `^1.110.0`
- A running debug session using a DAP adapter that supports:
  - `readMemory`
  - `evaluate`
- Typical supported adapters/workflows:
  - `cppdbg`
  - `cortex-debug`
  - GDB/LLDB-style register expressions (`$pc`, `$sp`, `$lr`, `x1`, etc.)

> Important: memory/register reads are available when the debug session is **stopped/paused**.

## Commands

- `StackScope: Open Memory View`
- `StackScope: Focus Memory View`
- `StackScope: Open Memory View (Editor Tab)`

## Configuration

### VS Code settings contribution

This extension currently does **not** contribute `contributes.configuration` settings in `settings.json`.

### Workspace-scoped persistence

StackScope persists these items in workspace state:

- Memory presets
- Register sets
- Selected register set

## Quick Start

1. Start a debug session.
2. Open StackScope from the panel or command palette.
3. Pause execution.
4. Open a target (`0x...`, `$sp`, `&symbol`) from the toolbar.
5. (Optional) switch register set and register output format in the Register Panel.

## Known Limitations (Current V1)

- Register panel is read-only (no register write-back yet).
- Some adapters differ in expression/result formatting; StackScope normalizes common cases but behavior may vary.
- View state persistence and some advanced interactions are still under active iteration.

## Roadmap

Near-term and planned improvements:

- Persist full view/session state across reloads.
- Byte-change highlighting improvements across run/stop cycles.
- Better call stack integration and richer frame-aware workflows.
- Cross-highlight interactions in the hex grid (for example, selecting a hex cell and highlighting its decoded counterpart).
- Additional UX parity ideas inspired by established memory viewers where appropriate.

## Architecture Notes (for contributors)

StackScope uses a layered architecture:

- `Host` (VS Code extension host)
- `Debug` (DAP gateway and session tracking)
- `Domain` (pure TypeScript models/logic)
- `Protocol` (typed host-webview RPC)
- `Webview` (React UI)

Design constraints:

- No direct debugger API calls from webview.
- Typed protocol (no untyped `any` messages).
- Domain layer has no `vscode` imports.

## Reporting Issues

Please use the issue templates:

- Bug Report
- Feature Request

They are located under `.github/ISSUE_TEMPLATE` and include fields for debugger adapter, repro steps, expected behavior, and roadmap alignment.

## Development

Install dependencies:

```bash
pnpm install
```

Build:

```bash
pnpm run compile
```

Type-check only:

```bash
pnpm run check-types
```

Lint:

```bash
pnpm run lint
```
