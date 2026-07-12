# Code Structure

Current repository structure (main source areas):

```text
src/
  extension.ts
  debug/
    contracts/
    dap/
    vscode/
  domain/
    config/
    documents/
    presets/
    registers/
  host/
    activate.ts
    bridge/
    commands/
    composition/
    providers/
    services/
  protocol/
  shared/
  webview/
    App.tsx
    RegistersApp.tsx
    main.tsx
    components/
    hooks/
    rpc/
```

## Key files and purpose

| File | Purpose |
| --- | --- |
| `src/extension.ts` | extension entry re-export |
| `src/host/activate.ts` | activation, registration, disposal wiring |
| `src/host/providers/StackScopeWebviewViewProvider.ts` | shared sidebar webview lifecycle and HTML setup |
| `src/host/providers/MemoryViewProvider.ts` | StackScope memory panel provider |
| `src/host/providers/RegisterViewProvider.ts` | StackScope Registers Activity Bar provider |
| `src/host/bridge/HostMessageRouter.ts` | typed method handlers and event push to webview |
| `src/host/services/MemoryDocumentService.ts` | document lifecycle, snapshots, and memory-read orchestration |
| `src/debug/vscode/VscodeSessionTracker.ts` | session state tracking/probing |
| `src/debug/vscode/SessionProbeGuard.ts` | stale asynchronous session-probe protection |
| `src/debug/dap/DapDebugGateway.ts` | DAP customRequest adapter for memory/register operations |
| `src/debug/dap/DapResponseNormalizer.ts` | stable memory-result and DAP error normalization |
| `src/debug/dap/DapAddressResolver.ts` | target expression resolution strategy |
| `src/domain/documents/MemoryDocument.ts` | immutable memory document model |
| `src/domain/documents/DocumentRegistry.ts` | active document registry |
| `src/domain/config/MemoryViewConfig.ts` | settings types, defaults, validation |
| `src/protocol/methods.ts` | typed RPC methods and payloads |
| `src/webview/App.tsx` | UI orchestration and state transitions |
| `src/webview/RegistersApp.tsx` | independent register inspection UI and register-set editing |
| `src/webview/hooks/usePagedMemory.ts` | page cache and loading logic |
| `src/webview/hooks/useMemoryEditing.ts` | bounded write, verification display, and undo state |
| `src/webview/hooks/MemoryLoadGeneration.ts` | stale page-response protection |
| `src/webview/components/VirtualMemoryGrid.tsx` | virtualized hex/decoded rendering |
| `src/webview/components/WriteDialogShell.tsx` | shared memory/register write-dialog layout and controls |
| `src/webview/memoryEditValue.ts` | memory and register input parsing, formatting, and width conversion |

## Supporting files

- `esbuild.js`: bundles extension host and webview outputs to `dist/`.
- `.vscode/launch.json`: `Run Extension` development launch profile.
- `.vscode/tasks.json`: watch tasks for TypeScript and esbuild.
