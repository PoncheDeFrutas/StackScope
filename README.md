# StackScope
Extensión VS Code para inspección de memoria en depuración.

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

StackScope es una extensión de VS Code para inspección de memoria durante sesiones de depuración. Usa DAP para leer memoria y resolver expresiones/direcciones/registros, y muestra una grilla virtualizada con columnas hex/decoded. Está pensada para flujos low-level: stack debugging, análisis de bytes cambiantes y navegación entre memoria y contexto de ejecución.

## Features

- Lectura de memoria vía DAP `readMemory`.
- Grilla virtualizada con columnas hex/decoded.
- Presets persistentes por workspace (guardar/eliminar).
- Botones rápidos para `$pc`, `$sp`, `$lr`.
- Panel de registros read-only.
- Register sets configurables.
- Navegación de call stack y disassembly en editor-tab.
- Resaltado de bytes cambiados entre ejecuciones.
- Persistencia de estado de vista por workspace.

## Tech Stack

- TypeScript 5.9
- React 18
- VS Code Extension API (`^1.110.0`)
- Esbuild (bundle)
- ESLint 9

## Getting Started

Requisitos:

- VS Code `^1.110.0`
- Sesión de debug activa
- Adapter con soporte para `readMemory` y `evaluate`

Uso básico:

1. Inicia depuración y pausa ejecución.
2. Abre `StackScope: Open Memory View`.
3. Ingresa un target (ej: `0x20000000`, `$sp`, `&myVar`) y presiona `Go`.
4. Ajusta columnas, unit size, formatos y total size desde Settings.
5. Usa el panel de registros y selector de register sets.
6. Abre `StackScope: Open Call Stack (Editor Tab)` para navegar frames y disassembly.

## Development Workflow

```bash
pnpm install
pnpm run compile
```

Para depurar extensión localmente, usa la configuración `Run Extension` en `.vscode/launch.json`.

## Available Scripts

| Script | Description |
| --- | --- |
| `pnpm run compile` | Type-check + lint + bundle (`esbuild.js`) |
| `pnpm run package` | Build producción (`--production`) |
| `pnpm run watch` | Watch paralelo (tsc + esbuild) |
| `pnpm run watch:tsc` | Watch TypeScript sin emitir |
| `pnpm run watch:esbuild` | Watch bundle esbuild |
| `pnpm run check-types` | `tsc --noEmit` |
| `pnpm run lint` | `eslint src` |
| `pnpm run test` | VS Code extension tests |
| `pnpm run compile-tests` | Compila tests a `out/` |
| `pnpm run watch-tests` | Watch tests a `out/` |
| `pnpm run vsix` | Empaqueta `.vsix` |
| `pnpm run vsix:publish` | Publica `.vsix` |

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

Lee `docs/contributing.md` y `docs/development.md` antes de proponer cambios.

## License

MIT License. Ver `LICENSE`.

## Documentation Update / Changelog

- README reestructurado y expandido con overview, features reales, stack, scripts y estructura.
- Badges y analytics actualizados para repo `PoncheDeFrutas/StackScope`.
- Links de documentación alineados con `docs/`.
