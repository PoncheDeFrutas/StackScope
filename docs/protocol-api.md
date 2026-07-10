# Protocol and Host API

StackScope uses typed request, response, and event messages between webview and extension host. Definitions live in src/protocol/.

## Message envelopes

- Request: type request, id, method, params
- Successful response: type response, id, success true, result
- Error response: type response, id, success false, error
- Event: type event, event, payload

WebviewMessageBus validates incoming response and event envelope shape before dispatching it. Invalid messages are ignored.

## Methods

MethodMap in src/protocol/methods.ts is source of truth.

### Initialization and documents

- init
- openDocument
- readMemory
- listDocuments
- selectDocument
- closeDocument
- updateDocument

### Presets and register sets

- listPresets
- savePreset
- deletePreset
- listRegisterSets
- saveRegisterSet
- updateRegisterSet
- deleteRegisterSet
- selectRegisterSet
- readRegisters

### View and debug navigation

- saveViewState
- saveRegisterViewState
- listCallStack
- selectStackFrame
- getDisassembly

## Events

EventMap in src/protocol/events.ts defines:

- sessionChanged
- documentChanged
- callStackChanged
- disassemblyChanged
- debugNavigationModeChanged

## Errors

ProtocolError includes code, message, and optional details. Host handlers convert unexpected exceptions through normalizeProtocolError before replying.

Webview clients receive ProtocolRequestError. It preserves host error code and details while retaining Error message behavior for existing UI handling.

## Responsibilities

- HostMessageRouter owns transport dispatch and response/event delivery.
- MemoryDocumentService owns document lifecycle and debugger-backed memory reads.
- HostClient exposes typed calls to React components.
- WebviewMessageBus correlates requests, dispatches events, and releases listeners and pending requests when disposed.

## View state ownership

- `saveViewState` persists memory-view target, configuration, and settings visibility.
- `saveRegisterViewState` persists only register value format so memory and Registers webviews do not overwrite each other's state.

## Change rule

Protocol changes must update MethodMap or EventMap, host handler registration, HostClient, consuming UI, and tests together.
