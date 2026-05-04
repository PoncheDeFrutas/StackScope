# StackScope
VS Code extension for debugger-backed memory inspection.

<!--
<p align="center">
  <img src="docs/assets/logo.svg" width="160" alt="StackScope logo" />
</p>
-->

![Version](https://img.shields.io/badge/version-0.1.2-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.110.0-007ACC)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![React](https://img.shields.io/badge/React-18-61DAFB)
![License: MIT](https://img.shields.io/badge/License-MIT-green)
![GitHub Repo stars](https://img.shields.io/github/stars/PoncheDeFrutas/StackScope?style=social)
![Visitors](https://visitor-badge.laobi.icu/badge?page_id=PoncheDeFrutas.StackScope)
![Wakatime](https://wakatime.com/badge/github/PoncheDeFrutas/StackScope.svg)

## Repository Metrics / Analytics

![Repobeats](https://repobeats.axiom.co/api/embed/8fda4b2d09a8bdc3777e9a6ea2c64c945a85f3e7.svg "Repobeats analytics")

## Overview

StackScope is a VS Code extension for memory inspection during debug sessions. It uses DAP to read memory and resolve expressions/addresses/registers, and renders a virtualized grid with hex/decoded columns. Built for low-level workflows like stack debugging, byte-change tracking, and navigation between memory and execution context.

## Features

- Memory reads via DAP `readMemory`.
- Virtualized grid with hex/decoded columns.
- Workspace-persisted presets (save/delete).
- Quick targets for `$pc`, `$sp`, `$lr`.
- Read-only register panel.
- Configurable register sets.
- Call stack/disassembly navigation in editor-tab.
- Changed-byte highlighting across runs.
- Workspace-scoped view state persistence.

## Tech Stack

- TypeScript 5.9
- React 18
- VS Code Extension API (`^1.110.0`)
- Esbuild (bundle)
- ESLint 9

## Getting Started

Requirements:

- VS Code `^1.110.0`
- Active debug session
- Adapter support for `readMemory` and `evaluate`

Basic flow:

1. Start debugging and pause execution.
2. Open `StackScope: Open Memory View`.
3. Enter target (e.g. `0x20000000`, `$sp`, `&myVar`) and press `Go`.
4. Adjust columns, unit size, formats, and total size in Settings.
5. Use register panel and register set selector.
6. Open `StackScope: Open Call Stack (Editor Tab)` to navigate frames and disassembly.

## Development Workflow

```bash
pnpm install
pnpm run compile
```

For local debugging, use `Run Extension` in `.vscode/launch.json`.

## Available Scripts

| Script | Description |
| --- | --- |
| `pnpm run compile` | Type-check + lint + bundle (`esbuild.js`) |
| `pnpm run package` | Production build (`--production`) |
| `pnpm run watch` | Parallel watch (tsc + esbuild) |
| `pnpm run watch:tsc` | Watch TypeScript without emit |
| `pnpm run watch:esbuild` | Watch esbuild bundle |
| `pnpm run check-types` | `tsc --noEmit` |
| `pnpm run lint` | `eslint src` |
| `pnpm run test` | VS Code extension tests |
| `pnpm run compile-tests` | Compile tests to `out/` |
| `pnpm run watch-tests` | Watch tests to `out/` |
| `pnpm run vsix` | Package `.vsix` |
| `pnpm run vsix:publish` | Publish `.vsix` |

## Project Structure

```
.
├─ src/
│  ├─ debug/
│  ├─ domain/
│  ├─ host/
│  ├─ protocol/
│  ├─ shared/
│  ├─ test/
│  └─ webview/
├─ docs/
├─ .github/
├─ .vscode/
├─ dist/
├─ out/
├─ esbuild.js
├─ eslint.config.mjs
├─ tsconfig.json
└─ package.json
```

## Documentation

- Start here: `docs/README.md`
- Quick usage: `docs/getting-started.md`
- Architecture: `docs/architecture.md`
- UI behavior: `docs/ui-behavior.md`
- Rendering internals: `docs/rendering.md`
- Protocol/API: `docs/protocol-api.md`
- Code structure: `docs/code-structure.md`
- Development: `docs/development.md`
- Known constraints: `docs/known-constraints.md`
- Contributing: `docs/contributing.md`
- Roadmap: `docs/roadmap.md`
- Changelog guide: `docs/changelog-guide.md`

## Contributing

Read `docs/contributing.md` and `docs/development.md` before proposing changes.

## License

MIT License. See `LICENSE`.

## Documentation Update / Changelog

- README restructured and expanded with overview, real features, stack, scripts, and structure.
- Badges and analytics updated for repo `PoncheDeFrutas/StackScope`.
- Documentation links aligned with `docs/`.
