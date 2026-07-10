# Change Log

All notable changes to the "StackScope" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.2.1] - 2026-07-10

### Changed

- Serialized workspace persistence and separated Memory/Registers view state.
- Bounded DAP request concurrency and ignored stale register refreshes.
- Split host message routing by responsibility and added provider lifecycle coverage.

## [0.2.0] - 2026-07-10

### Changed

- Moved register inspection from the memory view into a dedicated Activity Bar view.
- Added the `StackScope: Focus Registers View` command and shared sidebar webview lifecycle.

## [0.1.3] - 2026-07-09

### Changed

- Refactored host document handling, session probing, DAP response normalization, webview protocol handling, and paged memory loading.
- Updated project documentation and architecture notes.

## [0.1.2] - 2026-05-04

### Added

- Structured project documentation under `docs/` with focused pages.
- Roadmap document (`docs/roadmap.md`).
- Changelog/release process guide (`docs/changelog-guide.md`).

### Changed

- Root `README.md` now acts as a concise entrypoint to split documentation.
- Documentation refresh: expanded root README with full overview, features, scripts, structure, and metrics.
