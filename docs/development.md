# Development Setup

## Prerequisites

- Node.js runtime compatible with project dependencies
- `pnpm`
- VS Code

## Install dependencies

```bash
pnpm install
```

## Build commands

From `package.json`:

- `pnpm run compile`
  - runs `check-types`, `lint`, and `node esbuild.js`
- `pnpm run package`
  - production build (`--production`)
- `pnpm run watch`
  - parallel `watch:tsc` and `watch:esbuild`

## Verification commands

```bash
pnpm run check-types
pnpm run lint
pnpm run test
```

## Run extension locally (Extension Development Host)

Use `.vscode/launch.json` configuration `Run Extension`.

It launches VS Code with:

- `--extensionDevelopmentPath=${workspaceFolder}`
- `outFiles: ${workspaceFolder}/dist/**/*.js`
- preLaunch task: default build/watch task

## Build output

- `dist/extension.js` (host, CommonJS, platform node)
- `dist/webview.js` (webview bundle, IIFE, platform browser)

Configured in `esbuild.js`.

## Debugging notes

- Host-side logs appear in extension host context.
- Webview-side logs appear in webview devtools console.
- Message traffic is typed but transported via `postMessage`.
