# Getting Started

This page describes how to use the extension based on current code.

## What StackScope currently provides

- Memory view panel (`stackscope.memoryView`) rendered in a webview.
- Optional editor-tab webview command.
- Memory open by target expression.
- Virtualized hex/decoded rendering backed by paged debugger reads.
- Register panel with selectable register sets and value formatting.

## Requirements

- VS Code engine: `^1.110.0` (`package.json`)
- Active debug session
- Adapter support for DAP requests used by the extension:
  - `readMemory`
  - `evaluate`

The host rejects memory/register reads if session status is not `stopped`.

## Commands

- `StackScope: Open Memory View`
- `StackScope: Focus Memory View`
- `StackScope: Open Memory View (Editor Tab)`
- `StackScope: Open Call Stack (Editor Tab)`
- `StackScope: Open Disassembly (Editor Tab)`

Registered in `package.json` and wired in `src/host/commands/openMemoryViewCommand.ts`.

## Basic usage flow

1. Start a debug session.
2. Open StackScope panel.
3. Pause execution.
4. Enter target and press `Go` in the toolbar.
   - Examples: `0x20000000`, `$sp`, `&myVar`
5. Scroll memory grid; pages load lazily.
6. Use settings panel to change columns, unit size, formats, and total size.
7. Use register panel to select register set and value format.
8. Open `StackScope: Open Call Stack (Editor Tab)` to inspect threads/frames beside the source file.
9. Select a frame to reveal its source, switch the same tab to disassembly, and use that frame as the context for memory/register evaluation.
10. Use `StackScope: Open Disassembly (Editor Tab)` if you want to open the same navigation tab directly in disassembly mode.
11. Use the local mode switch in the navigation header to move between `Call Stack` and `Disassembly`.

## Target resolution behavior

Implemented in `src/debug/dap/DapAddressResolver.ts`:

- Hex literal (`0x...`) -> used directly.
- Decimal literal (`12345`) -> converted to hex.
- Register expression (`$pc`) -> evaluated.
- Bare register (`pc`, `x1`, `sp`) -> tries `$`-prefixed variant.
- Generic expression -> tries:
  1. expression as-is
  2. `&(expression)`
  3. `(void*)&(expression)`

## Presets and register sets persistence

Workspace state keys:

- Memory presets: `stackscope.presets`
- Register sets: `stackscope.registerSets`
- Selected register set: `stackscope.selectedRegisterSet`
- View state: `stackscope.viewState`

Implemented in:

- `src/host/services/PresetService.ts`
- `src/host/services/RegisterSetService.ts`
- `src/host/services/ViewStateService.ts`

Persisted view state currently includes:

- Current target
- Memory view configuration
- Settings panel visibility
- Register panel visibility and width
- Register value format

If the webview is restored without an active memory document, StackScope keeps the last target visible and will try to reopen it automatically once a debug session is available and `stopped`.
