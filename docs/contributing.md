# Contributing Notes

Practical notes for modifying this codebase safely.

## 1) Keep protocol changes atomic

When adding/changing host-webview methods, update together:

- `src/protocol/methods.ts`
- `src/host/bridge/HostMessageRouter.ts`
- `src/webview/rpc/HostClient.ts`
- consumer components/hooks in `src/webview/*`

## 2) Respect layer boundaries

- Do not import `vscode` in `src/domain/*`.
- Keep debugger-specific logic in `src/debug/*`.
- Keep storage concerns in `src/host/services/*`.

## 3) Rendering edits must preserve alignment contracts

`VirtualMemoryGrid` alignment depends on:

- fixed address width (`ch`)
- fixed per-cell width (`ch`)
- shared `ByteCell` primitive
- explicit gap components

If these contracts drift, headers/hex/decoded columns can misalign.

## 4) Session-state safety

Host handlers enforce paused-session reads.

If you add new read operations, follow existing checks for:

- active session existence
- stopped status

## 5) Recommended local checks

```bash
pnpm run check-types
pnpm run lint
pnpm run compile
```

## 6) Useful code navigation anchors

- App state: `src/webview/App.tsx`
- Memory paging: `src/webview/hooks/usePagedMemory.ts`
- Grid renderer: `src/webview/components/VirtualMemoryGrid.tsx`
- Host routing: `src/host/bridge/HostMessageRouter.ts`
- DAP gateway: `src/debug/dap/DapDebugGateway.ts`
