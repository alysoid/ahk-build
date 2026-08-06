# Project instructions

This repository implements a Windows-first build system for AutoHotkey v2 projects. Treat the exported configuration types, generated artifact semantics, and error codes as public contracts.

## Architecture

- Keep the public configuration declarative and serializable.
- Keep command orchestration separate from filesystem, process, toolchain, compiler, packaging, WiX, and release implementations.
- Invoke external executables with argument arrays and `shell: false`; never build interpolated shell commands.
- Never modify consumer source files during a build.
- Put consumer-generated files only in its configured build, dist, work, or cache directories.
- Read the consumer application version from `package.json` unless an accepted ADR changes the rule.
- Keep WiX authoring in consumer repositories. This package only validates and invokes it.
- Keep provider-specific behavior behind `src/toolchain/provider.ts`.
- Preserve underlying errors with `cause` when wrapping them.

## Compatibility

- Node.js 24 is the minimum supported runtime.
- Configuration loading, validation, manifest resolution, and ZIP creation must remain testable outside Windows.
- AutoHotkey execution, Ahk2Exe compilation, managed tool installation, and WiX builds must fail clearly outside Windows.
- Avoid depending on Scoop, PowerShell, 7-Zip, Make, or a globally installed AutoHotkey toolchain.

## Quality requirements

- Add or update tests for every behavioral change.
- Prefer small dependency-free functions for path mapping, templates, manifests, and command construction.
- Do not silently ignore filesystem, process, checksum, configuration, or artifact errors.
- Do not add dependencies that duplicate Node.js standard-library capabilities without documenting the reason.
- Do not broaden the public API while implementing one consumer-specific need. Use a local hook first, then generalize after a second real use case.
- Preserve deterministic ZIP ordering and timestamps.

## Required checks

Run all checks before completing a task:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

On Windows, also run the relevant CLI command against a fixture or real consumer. State explicitly when a Windows-only check was not executed.

## Change discipline

- Update `docs/architecture.md` when module boundaries change.
- Add an ADR under `docs/decisions/` before changing version ownership, provider semantics, archive mapping, or WiX ownership.
- Update `README.md` for every public configuration or CLI change.
- Keep commits focused and use Conventional Commits.
