# UI Behavior

This page describes current UI behavior from `src/webview/*`.

## Main UI composition

`src/webview/App.tsx` renders:

1. `Toolbar`
2. optional `SettingsPanel`
3. collapsible register section (`RegisterPanel`)
4. memory content (`VirtualMemoryGrid` or message state)
5. `StatusBar`
6. modal `RegisterSetEditor` when editing/creating sets

## App state phases

`AppState` phases:

- `loading`
- `no-session`
- `no-document`
- `opening-document`
- `ready`
- `error`

`renderContent(...)` switches on these phases and either renders messages or `VirtualMemoryGrid`.

## Session-driven behavior

- While `running`, memory view shows a pause message.
- On transition to `running`, baseline bytes are captured for change highlighting.
- On transition to `stopped`, pending refresh flags trigger:
  - memory page refresh (`refreshAll`)
  - register refresh (`readRegisters`)
- If no document is active but a persisted target exists, the webview keeps that target and attempts a deferred reopen once a session is `stopped`.
- Changed-byte highlighting only applies to offsets that had a known baseline before the previous `run`.
- Changed-byte state is cleared when a new run starts or a different target/document is opened.

## View persistence behavior

- Webview UI state is restored from workspace state during `init`.
- Persisted fields include:
  - current target
  - `MemoryViewConfig`
  - settings panel visibility
  - register panel visibility
  - register panel width
  - register value format
- Register set selection is persisted separately by host-side register set storage.

## Toolbar behavior (`src/webview/components/Toolbar.tsx`)

- Address/target input is disabled unless status is `stopped` and not loading.
- `Go` opens document via `onOpenDocument`.
- Preset selector loads selected preset target.
- Quick buttons open `$pc`, `$sp`, `$lr`.
- Includes save/delete preset controls.
- Includes settings toggle and manual refresh action.

## Register panel behavior (`src/webview/components/RegisterPanel.tsx`)

- Set selector chooses current register set.
- Value format selector changes display format:
  - `hex`, `dec`, `oct`, `bin`, `raw`
- Table columns are currently `Register` and `Value`.
- Register column displays `reg.expression`.
- Value column displays formatted value or placeholders (`--`, `Error`).
- While session is not stopped, panel shows pause message.
- While stale, table opacity is reduced.
- Refresh is manual and also triggered by stopped-state refresh pipeline.

## Register set editor behavior (`src/webview/components/RegisterSetEditor.tsx`)

- Modal overlay editor.
- Row-by-row list of register expression + optional label.
- Supports add, remove, move up/down.
- Keyboard behavior in expression input:
  - Enter: add new row and focus last
  - Backspace on empty row: remove row (if more than one)
- Save enabled only when name is non-empty and at least one expression exists.

## Status bar behavior (`src/webview/components/StatusBar.tsx`)

- Shows status dot and label (`No Session`, `Running`, `Stopped`).
- Shows session id prefix and current document address when available.
- Shows changed-byte count when the current document has verified diffs.
- Shows error text if current app state is `error`.

## Address / hex / decoded in current UI

Detailed rendering is in `docs/rendering.md`, but at UI level:

- Address is left-aligned fixed-width column.
- Hex section renders unit-based values per configured format.
- Decoded section renders only for `unitSize === 1` and non-hidden mode.
- Loading/unreadable states are represented inline by placeholder glyphs.
- Changed bytes highlight in both hex and decoded cells, then visually fade while remaining marked for the current inspection cycle.
