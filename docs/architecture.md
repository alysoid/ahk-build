# Architecture

## Public surface

The public package exports `defineConfig` and TypeScript configuration types. The CLI is the primary operational interface. Consumer repositories should not import internal command or provider implementations.

## Configuration boundary

`src/config/load-config.ts` locates a TypeScript or JavaScript configuration, loads it with Node.js, validates untrusted values with Zod, reads package metadata, and resolves directories. Paths remain project-relative at the public boundary and become absolute only inside the resolved configuration.

## Command layer

Files under `src/commands/` orchestrate operations and hooks. They should contain little implementation logic. Reusable behavior belongs to focused modules under `compile`, `toolchain`, `package`, `wix`, or `release`.

## Toolchain layer

The provider interface returns paths to AutoHotkey, Ahk2Exe, and optionally UPX. The managed provider downloads pinned archives, verifies SHA-256, extracts the requested executable, and stores it in a shared cache. The system provider resolves configured paths or executables from `PATH`.

A provider must not decide application metadata, output paths, archive contents, or release behavior.

## Compilation layer

The compiler creates a generated source under the work directory, applies template replacements, optionally replaces old Ahk2Exe directives, injects metadata, and invokes Ahk2Exe. Compression is an explicit post-compilation operation.

## Packaging layer

Portable packaging expands explicit files, directories, and globs into a validated manifest. Every archive destination is normalized, duplicate destinations fail, entries are sorted, and timestamps are fixed.

## WiX layer

WiX is optional. The package passes standard build definitions and consumer-defined values to `wix build`. It never generates product authoring, UpgradeCodes, component GUIDs, features, shortcuts, registry entries, or installer UI.

## Release layer

The release command orchestrates the existing build command, then delegates Git
state/version handling and GitHub publication to focused release modules. Git
preflight requires a clean, non-diverged upstream; release pushes are atomic and
never force or rewrite tags.

GitHub publication verifies every local asset, rejects duplicate upload
basenames, creates a draft with `--verify-tag`, compares uploaded sizes and
SHA-256 digests, and only then publishes it. `--publish-only` exposes this
publication layer without rebuilding or changing Git.

## Extension policy

Project-specific preparation belongs in declarative hooks. A new core capability should be introduced only when at least two consumers require the same semantics and hooks would produce duplicated, error-prone implementations.
