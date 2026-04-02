# Guide: Extending StackScope

This guide explains where to implement common extension changes using current architecture.

## Add a new host-webview feature

1. Define protocol types in `src/protocol/methods.ts`.
2. Implement host handler in `src/host/bridge/HostMessageRouter.ts`.
3. Add typed client method in `src/webview/rpc/HostClient.ts`.
4. Consume method in `src/webview/App.tsx` or target component.

Keep request/response types synchronized across all 4 points.

## Add a new memory display mode

Main files:

- `src/domain/config/MemoryViewConfig.ts`
- `src/webview/components/SettingsPanel.tsx`
- `src/webview/components/VirtualMemoryGrid.tsx`

Typical steps:

1. Extend the relevant type union (e.g., decoded/number format).
2. Add option to valid constants list.
3. Add selector option in settings UI.
4. Implement rendering in `formatValue` or `formatDecodedByte`.

## Change virtual loading behavior

Main file: `src/webview/hooks/usePagedMemory.ts`

Adjust:

- `PAGE_SIZE`
- `OVERSCAN_PAGES`
- parallel load limit (`MAX_CONCURRENT`)
- refresh logic (`refreshAll`)

## Add new debug resolution logic

For memory target resolution:

- `src/debug/dap/DapAddressResolver.ts`

For raw read/evaluate behavior:

- `src/debug/dap/DapDebugGateway.ts`

## Add a new persisted workspace entity

Pattern is implemented by:

- `src/host/services/PresetService.ts`
- `src/host/services/RegisterSetService.ts`

Use `context.workspaceState` with explicit storage keys and mapping to domain models.

## Safe-change checklist

- Preserve domain purity (`src/domain/*` no `vscode` imports).
- Keep protocol method unions and `MethodMap` consistent.
- Keep memory row alignment (`ch` widths) when editing renderer.
- Keep stopped-session checks for debugger reads.
- Run type-check and lint before committing.
