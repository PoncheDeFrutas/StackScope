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
- Refresh keeps old page data visible while in-flight to avoid blanking.

## Register panel constraints

- Register panel is read-only (no write-back path in protocol or host).
- Register table currently displays expression in first column.
- Value formatting in panel is client-side formatting of returned `value` strings.

## Miscellaneous observations

- `src/webview/components/MemoryGrid.tsx` exists but `App.tsx` currently uses `VirtualMemoryGrid.tsx`.
- In `formatDecodedByte` ASCII branch, the `byte === 0x20` case appears after printable-byte handling, so printable space is already handled by the first branch.
