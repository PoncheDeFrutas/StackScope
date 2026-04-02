# Changelog and Release Guide

This guide describes how this repository currently tracks releases.

## Source files involved

- `CHANGELOG.md`
- `package.json` (version)

## Current changelog format in repo

`CHANGELOG.md` already includes:

- `## [Unreleased]`

Recommended structure in this repo:

```md
## [Unreleased]

### Added
- ...

### Changed
- ...

### Fixed
- ...

## [0.1.0] - 2026-04-02

### Added
- ...
```

## Release checklist

1. Ensure local checks pass:

```bash
pnpm run check-types
pnpm run lint
pnpm run compile
```

2. Move completed notes from `[Unreleased]` into a new version section.
3. Bump `package.json` version.
4. Keep release notes aligned with real merged changes only.

## Versioning approach used so far

Current version in `package.json` is `0.1.0`.

Practical progression:

- `0.1.x`: fixes and incremental improvements
- `0.2.0`: substantial feature increment
- `1.0.0`: when baseline behavior is considered stable

## Example release commit content

- `package.json` version bump
- `CHANGELOG.md` new version section
- optional docs updates if feature set changed
