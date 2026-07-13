# UI Behavior

This page describes current UI behavior from `src/webview/*`.

## Main UI composition

`src/webview/App.tsx` renders:

1. `Toolbar`
2. optional `SettingsPanel`
3. memory content (`VirtualMemoryGrid` or message state)
4. `StatusBar`

Separate webviews render `RegistersApp` for register inspection and `DebugNavigationApp` for editor-tab execution navigation.

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
- On transition to `stopped`, memory view refreshes loaded pages (`refreshAll`).
- If no document is active but a persisted target exists, the webview keeps that target and attempts a deferred reopen once a session is `stopped`.
- Changed-byte highlighting only applies to offsets that had a known baseline before the previous `run`.
- Changed-byte state is cleared when a new run starts or a different target/document is opened.
- Call stack changes emitted by host cause memory view to refresh against the currently selected StackScope frame when possible.

## Debug navigation behavior (`src/webview/DebugNavigationApp.tsx`)

- Available through editor-tab commands `stackscope.openCallStackInEditor` and `stackscope.openDisassemblyInEditor`.
- Both commands open the same StackScope navigation tab and choose the initial local mode.
- The tab has two local modes:
  - `Call Stack`: threads + frames
  - `Disassembly`: instruction flow around the selected frame
- Selecting a frame:
  - stores a StackScope-owned thread/frame selection in host state
  - reveals the frame source file if a local path is available
  - switches the tab locally from `Call Stack` to `Disassembly`
  - updates memory/register evaluation context independently from VS Code's native call stack selection
- Disassembly highlights the current instruction and recenters when the debugger stop location changes.
- Disassembly keeps the previous instruction list visible during step/refresh and marks it as syncing instead of replacing the whole view with a loading screen.
- If the adapter does not support disassembly or the frame lacks an instruction pointer reference, the tab shows a message instead of crashing.

## View persistence behavior

- Webview UI state is restored from workspace state during `init`.
- Memory view persists:
  - current target
  - `MemoryViewConfig`
  - settings panel visibility
- Registers view persists register value format through `saveRegisterViewState`.
- Legacy register-panel visibility and width fields remain compatible with stored workspace state but are not used by current UI.
- Register set selection is persisted separately by host-side register set storage.

## Toolbar behavior (`src/webview/components/Toolbar.tsx`)

- Address/target input is disabled unless status is `stopped` and not loading.
- `Go` opens a temporary memory document via `onOpenDocument`; it does not persist a saved entry.
- Saved selector loads selected preset target.
- Quick buttons open `$pc`, `$sp`, `$lr`; those quick targets are not shown in the saved selector.
- Includes adjacent save/delete controls for saved preset entries.
- Includes settings toggle and manual refresh action.

## Registers view behavior (`src/webview/RegistersApp.tsx`)

- Available from StackScope Activity Bar container or `StackScope: Focus Registers View`.
- Set selector chooses current register set.
- Value format selector changes display format:
  - `hex`, `dec`, `oct`, `bin`, `raw`
- Table columns are `Register` and `Value`; alternating row backgrounds and hover state improve scanability.
- Register column displays `reg.expression`.
- Value column is an edit action when register writes are supported.
- Value column displays formatted value or placeholders (`--`, `Error`).
- While session is not stopped, view shows pause message.
- While stale, table opacity is reduced.
- Refresh is manual and also triggered by `sessionChanged` stopped events and `callStackChanged` events.
- Registers and Watchpoints are separate Explorer-style collapsible sections. The Watchpoints section shows backend, access mode, verification state, and hit highlighting.

## Memory and register writes

- Memory selection opens a write dialog only when memory writes are supported and session is stopped.
- Memory input accepts `hex`, `dec`, `oct`, `bin`, and `ascii`. Numeric values use current memory endianness; ASCII writes only entered bytes.
- Verified memory writes update loaded bytes and create bounded undo entries. Partial writes only undo verified bytes.
- Register value actions open a matching dialog when register writes are supported and session is stopped.
- Register input accepts same numeric/ASCII formats with selected 8-, 16-, 32-, 64-, or 128-bit width. `raw` sends entered debugger expression unchanged.
- Both dialogs use `WriteDialogShell` for shared preview, error, cancel, and confirm behavior.

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
