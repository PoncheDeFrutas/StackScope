# Known Constraints and Code Observations

These points are direct observations from current code.

## Debug/session constraints

- Memory and register reads are guarded by host checks requiring session status `stopped`.
- `DapDebugGateway.findSession` only checks `vscode.debug.activeDebugSession` against `sessionId`; it does not search non-active sessions.

## Rendering constraints

- Decoded column is only rendered when `unitSize === 1` and mode is not `hidden`.
- `VirtualMemoryGrid` receives `previousData?` prop but does not use it in current implementation.
- Address formatting is fixed to 16 hex digits.

## Data/loading constraints

- Page cache returns `null` from `getBytes` if any page in requested range is not loaded; row then renders loading placeholders.
- Refresh keeps old page data visible while reloading. Load generations discard delayed responses from earlier document selections or refreshes.

## Registers view constraints

- Memory and register writes require a stopped session and adapter capability support; StackScope can use supported GDB fallbacks when native DAP write requests are absent.
- Register width defaults are inferred from displayed hexadecimal value. When width cannot be inferred, editor defaults to 64-bit and user can change it.
- Register table currently displays expression in first column.
- Value formatting is client-side formatting of returned `value` strings.

## Miscellaneous observations

- In `formatDecodedByte` ASCII branch, the `byte === 0x20` case appears after printable-byte handling, so printable space is already handled by the first branch.
