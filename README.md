# @alysoid/ahk-build

A Windows-first, reproducible build workflow for AutoHotkey v2 applications. The package keeps project configuration declarative while centralizing toolchain acquisition, compilation, portable archives, optional WiX installers, and GitHub releases.

## Design goals

- One application version, read from the consumer's `package.json`.
- No mutation of the original `.ahk` source during builds.
- Managed tools downloaded from upstream sources and verified by SHA-256.
- A `system` provider for custom, Scoop, or manually installed tools.
- Deterministic ZIP archives with sorted entries and normalized timestamps.
- Optional WiX orchestration without generating or owning consumer `.wxs` files.
- Shell-free process execution with argument arrays.
- Useful validation on every platform; execution and compilation remain Windows-only.

## Requirements

- Node.js 24 or newer.
- Windows for `setup`, `run`, `compile`, `build`, `msi`, and end-to-end `release`.
- WiX must be installed separately when `wix` is enabled.
- Git and an upstream branch are required for end-to-end `release`; Git tag
  signing must be configured unless `release.signTag` is `false`.
- GitHub CLI must be installed and authenticated for `release`.

## Installation

```bash
pnpm add -D @alysoid/ahk-build
# or: npm install --save-dev @alysoid/ahk-build
```

Create `ahk-build.config.ts`:

```ts
import { defineConfig } from "@alysoid/ahk-build";

export default defineConfig({
  entry: "MyApp.ahk",
  app: {
    name: "My App",
    executable: "MyApp.exe",
    artifactName: "MyApp",
    description: "A small AutoHotkey v2 application",
    publisher: "Example Publisher",
    icon: "assets/app.ico",
  },
  compile: {
    architecture: "x64",
    compression: "none",
  },
  portable: {
    files: [
      { from: "${buildDir}/MyApp.exe", to: "MyApp.exe" },
      "LICENSE",
      { from: "assets/runtime", to: "assets" },
    ],
  },
  wix: false,
  release: false,
});
```

Add scripts:

```json
{
  "scripts": {
    "doctor": "ahk-build doctor",
    "setup": "ahk-build setup",
    "dev": "ahk-build run",
    "build": "ahk-build build",
    "release": "ahk-build release"
  }
}
```

The default replacement changes every `__APP_VERSION__` token in the generated source to `package.json.version`. See [Configuration reference](docs/configuration.md) for all options.

## Commands

`doctor` validates configuration and referenced files, then reports toolchain status. `setup` installs the managed toolchain. `run` executes the source with AutoHotkey. `clean` removes generated project files. `compile` generates compiler metadata and builds the executable. `zip` creates the configured deterministic portable archive (`package` is an alias). `msi` invokes WiX when configured. `build` cleans, compiles, and creates each enabled artifact. `release [version]` performs Git preflight, optionally updates `package.json`, builds, confirms, commits, tags, atomically pushes, and publishes verified GitHub assets. Set `release.generateNotes: true` to use a simple local commit list when `release.notes` is omitted.

The package's own npm and GitHub publication is handled by the tag-triggered Trusted Publishing workflow; consumer `release` commands do not publish this npm package.

Global options include `--cwd`, `--config`, `--verbose`, `--force` for toolchain setup, and `--cache` for a full clean. Release adds `--dry-run`, `--yes`, and `--publish-only`. Arguments after `--` are forwarded by `run` to the AHK script.

## Documentation

- [Configuration reference](https://github.com/alysoid/ahk-build/blob/main/docs/configuration.md)
- [Toolchain model](https://github.com/alysoid/ahk-build/blob/main/docs/toolchain.md)
- [Architecture](https://github.com/alysoid/ahk-build/blob/main/docs/architecture.md)
- [Consumer migration checklist](https://github.com/alysoid/ahk-build/blob/main/docs/migration.md)
- [Release checklist](https://github.com/alysoid/ahk-build/blob/main/docs/release-checklist.md)
- [Architectural decisions](https://github.com/alysoid/ahk-build/tree/main/docs/decisions)

## Development

```bash
corepack enable
pnpm install
pnpm check
```

Real toolchain compilation tests are opt-in because they download Windows binaries:

```powershell
$env:AHK_BUILD_INTEGRATION = "1"
pnpm test
```

Repository invariants and required checks are documented in [AGENTS.md](https://github.com/alysoid/ahk-build/blob/main/AGENTS.md); module boundaries are documented in [Architecture](https://github.com/alysoid/ahk-build/blob/main/docs/architecture.md).
