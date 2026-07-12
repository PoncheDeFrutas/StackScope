# Architecture

This architecture description is derived from the current repository code.

## Layered structure

- `Host` (`src/host/*`): VS Code integration and message routing.
- `Debug` (`src/debug/*`): debugger-facing contracts and DAP implementation.
- `Domain` (`src/domain/*`): pure TypeScript models and validation.
- `Protocol` (`src/protocol/*`): typed method/event/error contracts.
- `Webview` (`src/webview/*`): React UI and client-side state.

## Runtime component map

```mermaid
flowchart LR
  MEMORY[Memory webview\nApp.tsx] --> BUS[WebviewMessageBus]
  REGISTERS[Registers webview\nRegistersApp.tsx] --> BUS
  BUS -->|request/response| ROUTER[HostMessageRouter]
  ROUTER --> TRACKER[VscodeSessionTracker]
  ROUTER --> GATEWAY[DapDebugGateway]
  ROUTER --> PRESETS[PresetService]
  ROUTER --> REGSETS[RegisterSetService]
  ROUTER --> STACKSEL[StackSelectionService]
  ROUTER --> DOCS[MemoryDocumentService]
  DOCS --> REGISTRY[DocumentRegistry]
  GATEWAY --> DAP[VS Code DebugSession customRequest]
  ROUTER -->|events| BUS
```

## Activation and composition

### Entry points

- `src/extension.ts` exports `activate` and `deactivate` from `src/host/activate.ts`.

### Activation

`src/host/activate.ts`:

- creates services via `createHostServices`
- registers `MemoryViewProvider` for memory panel and `RegisterViewProvider` for Registers Activity Bar view
- registers six StackScope commands
- sets cleanup disposables for tracker/provider

### Composition root

`src/host/composition/createHostServices.ts` wires:

- `VscodeSessionTracker`
- `DapDebugGateway`
- `DapCapabilitiesService`
- `DebugMutationService`
- `DocumentRegistry`
- `PresetService`
- `RegisterSetService`
- `StackSelectionService`
- `HostMessageRouter`
- `MemoryViewProvider`
- `RegisterViewProvider`

## Data flow

```mermaid
sequenceDiagram
  participant W as Webview (App or RegistersApp)
  participant B as WebviewMessageBus
  participant H as HostMessageRouter
  participant S as SessionTracker
  participant D as DebugGateway
  participant M as MemoryDocumentService
  participant R as DocumentRegistry

  W->>B: init()
  B->>H: request init
  H->>S: refresh()
  H->>R: getActive()
  H-->>B: InitResult
  B-->>W: session + docs + presets + register sets + view state

  W->>B: openDocument(target)
  B->>H: request openDocument
  H->>M: openDocument(target)
  M->>S: refresh()
  M->>D: evaluateForMemoryReference(target)
  M->>R: add/setActive
  H-->>B: OpenDocumentResult
  H-->>B: event documentChanged

  W->>B: readMemory(documentId, offset, count)
  B->>H: request readMemory
  H->>M: readMemory(...)
  M->>S: refresh()
  M->>D: readMemory(...)
  H-->>B: ReadMemoryResult
```

## Session state handling

`VscodeSessionTracker` uses multiple sources:

- `onDidStartDebugSession`
- `onDidTerminateDebugSession`
- `onDidReceiveDebugSessionCustomEvent`
- `onDidChangeActiveStackItem`
- `onDidChangeActiveDebugSession`

It also probes session status using `threads` and `stackTrace` in `probeSessionState`.

`SessionProbeGuard` invalidates older probes when session or stack events arrive. A delayed probe therefore cannot overwrite newer session state.

## Memory document and paging state

`MemoryDocumentService` owns document opening, selection, closure, metadata updates, DAP-backed reads, and `documentChanged` events. `DocumentRegistry` remains the in-memory store for immutable `MemoryDocument` values.

The webview hook `usePagedMemory` keeps page cache state. `MemoryLoadGeneration` marks each reset or full refresh; responses from older generations are ignored because debugger requests cannot always be cancelled after dispatch.

## DAP response handling

`DapDebugGateway` remains the VS Code adapter. `DapResponseNormalizer` converts DAP memory responses into the stable `ReadMemoryResult` shape, including base64 decoding, unreadable-byte padding, and numeric-address fallback.

`DapCapabilitiesService` records adapter write support. `DebugMutationService` serializes writes and verification reads per session. Memory writes are re-read through `MemoryDocumentService`; register writes use adapter expression evaluation and may provide a read-back value.

## Webview/provider model

- `StackScopeWebviewViewProvider` owns common sidebar webview setup, router attachment, visibility, focus, and disposal.
- `MemoryViewProvider` configures the StackScope memory panel view.
- `RegisterViewProvider` configures the StackScope Registers Activity Bar view.
- `src/webview/main.tsx` selects `App` or `RegistersApp` from the injected webview kind.
- Editor-tab command also creates a `WebviewPanel` with same bundled `dist/webview.js`.
- The bundle can render memory, registers, or unified debug-navigation views based on the injected webview kind.
- Router attach/detach is called on disposal/visibility transitions.

## Independent view state

Memory and Registers webviews each call `init` and receive shared session and call-stack events through `HostMessageRouter`. `App` owns memory target/configuration state; `RegistersApp` owns register set selection, values, editor state, and value format.

`ViewStateService.save` preserves register-related fields already stored by the Registers view. `saveRegisterViewState` updates only the register value format. This prevents one webview from overwriting the other's persisted state.
