# StackScope

VS Code extension for inspecting debugger-backed memory during a stopped debug session.

<p align="center">
  <img src="docs/assets/stackscope.png" width="160" alt="StackScope logo" />
</p>

![Version](https://img.shields.io/badge/version-0.5.1-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.110.0-007ACC)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![React](https://img.shields.io/badge/React-18-61DAFB)
![License: MIT](https://img.shields.io/badge/License-MIT-green)
![GitHub Repo stars](https://img.shields.io/github/stars/PoncheDeFrutas/StackScope?style=social)
![Visitors](https://visitor-badge.laobi.icu/badge?page_id=PoncheDeFrutas.StackScope)
<!--[![wakatime](https://wakatime.com/badge/user/dd9cbf79-b76d-4202-aae2-be6bff8a804e/project/431c9b81-461b-4b48-8040-eb16655aca27.svg)](https://wakatime.com/badge/user/dd9cbf79-b76d-4202-aae2-be6bff8a804e/project/431c9b81-461b-4b48-8040-eb16655aca27)

## Repository Metrics / Analytics

![Repobeats](https://repobeats.axiom.co/api/embed/18b83e6284c2b80d767b8d9ce1c372ba2c90fdc1.svg "Repobeats analytics image")-->


## What it does

StackScope reads and writes debugger-backed memory through the active debug adapter, presenting it in virtualized hex and decoded view. Memory and registers have separate VS Code views. It also supports address expressions, register sets, memory presets, byte-change tracking, register and memory watchpoints, call-stack navigation, and disassembly navigation.

## Requirements

- VS Code version ^1.110.0
- Active, stopped debug session
- Debug adapter supporting DAP readMemory and expression evaluation

Some workflows, including call stack and disassembly, also depend on adapter support for corresponding DAP requests.

## Quick start

1. Start debugging and pause execution.
2. Run **StackScope: Open Memory View**.
3. Enter target such as 0x20000000, $sp, or &myVar.
4. Scroll to load memory pages. Use Settings to change columns, unit size, number format, and total size.
5. Open **StackScope: Focus Registers View** to inspect registers in its own Activity Bar view.
6. When adapter write support is available, select memory bytes or a register value to edit it. Memory accepts hex, decimal, octal, binary, and ASCII; registers also accept a raw debugger expression.
7. Select a register or memory range watch action while paused. DAP data breakpoints are used first; `cppdbg` sessions configured with GDB can use the GDB fallback when the adapter does not expose data breakpoints.

## Commands

- **StackScope: Open Memory View**
- **StackScope: Focus Memory View**
- **StackScope: Focus Registers View**
- **StackScope: Open Memory View (Editor Tab)**
- **StackScope: Open Call Stack (Editor Tab)**
- **StackScope: Open Disassembly (Editor Tab)**

## Development

    pnpm install
    pnpm run compile

Use **Run Extension** from .vscode/launch.json for an Extension Development Host.

## Documentation

- [Getting started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Protocol and host API](docs/protocol-api.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)
- [Known constraints](docs/known-constraints.md)
- [Documentation index](docs/README.md)

## Limitations

Memory and register reads require stopped session. Watchpoint availability depends on the active adapter: DAP data breakpoints are preferred, while GDB register fallback requires `cppdbg` with `MIMode: "gdb"` and may be limited by hardware watchpoint resources.

## License

[MIT](LICENSE)
