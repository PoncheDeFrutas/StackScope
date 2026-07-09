# Testing

## Commands

    pnpm run check-types
    pnpm run lint
    pnpm run compile-tests
    pnpm run test

compile runs type checking, linting, and esbuild. package performs production bundle after same checks.

## Test layout

Tests live in src/test/ and compile to out/test/.

Pure tests cover domain services and extracted boundary helpers, including document lifecycle, protocol envelopes, DAP response normalization, session probe generations, and memory-load generations.

Extension integration tests run through VS Code Test CLI. They require VS Code runtime download or cached runtime and can depend on local display/runtime configuration.

## Adding tests

1. Add a focused file in src/test/ ending in .test.ts.
2. Prefer pure helper or service tests for state transitions and adapter-response normalization.
3. Use extension-host tests when behavior requires VS Code API wiring.
4. Run compile-tests before VS Code Test CLI when executing tests directly.

## Current limits

Host router and DAP gateway use VS Code APIs, so their end-to-end coverage depends on extension runtime. Keep pure conversion, state, and protocol decisions separately testable where practical.
