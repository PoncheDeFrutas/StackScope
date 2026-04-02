# StackScope

StackScope is a VS Code extension for debugger-backed memory inspection.

It reads memory through DAP requests and renders it in a virtualized hex/decoded grid, with workspace-scoped presets and a register panel.

## Documentation

The documentation is split into focused Markdown files under `docs/`.

- Start here: [`docs/README.md`](docs/README.md)
- Quick usage: [`docs/getting-started.md`](docs/getting-started.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md)
- UI behavior: [`docs/ui-behavior.md`](docs/ui-behavior.md)
- Rendering internals: [`docs/rendering.md`](docs/rendering.md)
- Protocol/API: [`docs/protocol-api.md`](docs/protocol-api.md)
- Extension guide: [`docs/guides/extending.md`](docs/guides/extending.md)
- Roadmap: [`docs/roadmap.md`](docs/roadmap.md)
- Changelog guide: [`docs/changelog-guide.md`](docs/changelog-guide.md)

## Features (current code)

- Open memory from literal addresses, registers, or expressions
- Virtualized memory view with hex and decoded columns
- Configurable view settings (columns, unit size, endianness, number format, decoded mode, total size)
- Memory presets (built-in + workspace user presets)
- Register panel with configurable register sets and value formatting

## Development

```bash
pnpm install
pnpm run compile
```

For local extension debugging, use VS Code launch config `Run Extension`.

## License

MIT License. See [`LICENSE`](LICENSE).
