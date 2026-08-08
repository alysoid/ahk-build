# Configuration reference

Export a configuration from `ahk-build.config.ts`, `.mts`, `.js`, or `.mjs`. The canonical TypeScript types are exported by the package; runtime validation is implemented in `src/config/schema.ts`.

```ts
import { defineConfig } from "@alysoid/ahk-build";

export default defineConfig({
  entry: "MyApp.ahk",
  app: { name: "My App", executable: "MyApp.exe" },
});
```

The application version always comes from the consumer's `package.json`.

## Top-level fields

| Field         | Required | Purpose                                                           |
| ------------- | -------- | ----------------------------------------------------------------- |
| `entry`       | yes      | Project-relative AutoHotkey entry file.                           |
| `app`         | yes      | Application name, executable name, metadata, icon, and resources. |
| `directories` | no       | Build, distribution, work, and cache locations.                   |
| `toolchain`   | no       | Managed or system toolchain; defaults to managed.                 |
| `compile`     | no       | Compilation, source staging, replacements, and runtime assets.    |
| `portable`    | no       | Portable ZIP manifest; omitted or `false` disables it.            |
| `wix`         | no       | WiX build settings; omitted or `false` disables MSI output.       |
| `release`     | no       | GitHub release settings; omitted or `false` disables publishing.  |
| `hooks`       | no       | Subprocesses run at command lifecycle boundaries.                 |

## Application and directories

`app.name` and `app.executable` are required. Optional fields are `artifactName`, `description`, `publisher`, `copyright`, `language`, `icon`, and `resources`. Each resource has a project-relative `source` and a positive numeric `id`. `artifactName` defaults to the executable filename without its extension and controls default ZIP and MSI names.

Directory defaults are:

| Field               | Default                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `directories.build` | `build`                                                                                                    |
| `directories.dist`  | `dist`                                                                                                     |
| `directories.work`  | `.ahk-build`                                                                                               |
| `directories.cache` | `%LOCALAPPDATA%\ahk-build\cache` on Windows; `$XDG_CACHE_HOME/ahk-build` or `~/.cache/ahk-build` elsewhere |

Configured relative directory paths resolve from the project root. `AHK_BUILD_CACHE_DIR` overrides the default cache location; an explicit `directories.cache` takes precedence.

## Compilation

| Field            | Default                     | Purpose                                                                          |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------- |
| `architecture`   | `x64`                       | AutoHotkey base executable architecture; accepts `x64` or `x86`.                 |
| `compression`    | `none`                      | Optional `upx` post-compilation step.                                            |
| `output`         | `${buildDir}/${executable}` | Executable output path.                                                          |
| `replacements`   | none                        | Additional generated-source token replacements.                                  |
| `includes`       | none                        | Files or directories copied beside the generated source.                         |
| `assets`         | none                        | Files or directories copied beside the compiled executable.                      |
| `additionalArgs` | none                        | Additional Ahk2Exe arguments.                                                    |
| `upxArgs`        | `--best`                    | Arguments used when UPX compression is enabled.                                  |
| `directives`     | `replace`                   | `replace` generates metadata directives; `preserve` retains consumer directives. |

Every `__APP_VERSION__` token is replaced with `package.json.version`. Configured replacement values support template variables.

With `directives: "replace"`, existing `;@Ahk2Exe-*` lines are removed from the generated copy and metadata directives are generated from `app` and `package.json`. The consumer source is never modified. Commas in directive values are escaped.

`includes` and `assets` accept project-relative strings or `{ from, to }` objects. Strings use the source basename as the destination. Object destinations must remain inside the generated-source or executable directory. Use `includes` for relative `#Include` dependencies and `assets` for runtime files.

## Toolchain

The default managed provider accepts partial overrides for `autoHotkey`, `ahk2exe`, and `upx`; each tool specification contains `version`, `url`, `sha256`, and `executable`. Set `upx: false` to disable managed UPX resolution.

The system provider requires `autoHotkey` and `ahk2exe`; `upx` is optional:

```ts
toolchain: {
  provider: "system",
  autoHotkey: "AutoHotkey64.exe",
  ahk2exe: "Ahk2Exe.exe",
  upx: "upx.exe",
}
```

Values may be project-relative paths, absolute paths, or executable names resolved through `PATH`. See [Toolchain model](toolchain.md).

## Portable archives

`portable.files` is required when portable packaging is enabled. Entries accept project-relative strings or `{ from, to }` objects and may identify files, directories, or globs. `portable.exclude` contains exclusions applied while expanding directories and globs. `portable.output` defaults to `${distDir}/${artifactName}-${packageVersion}.zip`.

Literal string files use their basename as the archive destination. String globs preserve project-relative paths. For object entries, `to` is the file destination or destination root. Duplicate and unsafe archive paths fail the build. Entries are sorted and timestamps are fixed, so ZIP output is deterministic when input bytes are identical.

Ahk2Exe can emit different padding bytes in `VERSION_INFO` when compilation roots or invocation contexts differ. Metadata and extracted resources remain equivalent, but raw EXE equality is not guaranteed; ZIP bytes consequently differ when the compiled input differs.

## WiX

`wix.source` is required. Optional fields are `output`, `architecture`, `executable`, `extensions`, `defines`, and `additionalArgs`. Defaults are:

- `output`: `${distDir}/${artifactName}-${packageVersion}.msi`
- `architecture`: `compile.architecture`
- `executable`: `wix`

The command supplies `ProductVersion`, `ProjectRoot`, `BuildDir`, and `DistDir` definitions, then adds configured definitions. Consumer repositories own all `.wxs` authoring.

## Releases

`release.repository` is required and is passed to the GitHub CLI's `--repo` option. Optional fields are `tag`, `title`, `notes`, `generateNotes`, `assets`, `draft`, `prerelease`, `commitMessage`, and `signTag`. Defaults are:

- `tag`: `v${packageVersion}`
- `title`: `Release v${packageVersion}`
- `notes`: `Release version ${packageVersion}`
- `generateNotes`: `false`
- `assets`: enabled portable and MSI outputs
- `commitMessage`: `chore(release): prepare ${packageVersion}`
- `signTag`: `true`

`ahk-build release [version]` requires a clean Git worktree and a current
upstream branch. A positional version updates only `package.json`, then the
command builds all enabled artifacts, runs `beforeRelease`, asks for
confirmation, commits the version when changed, creates and verifies the tag,
atomically pushes branch and tag, and creates a draft GitHub release with
`--verify-tag`. Local and uploaded asset names, sizes, and SHA-256 digests must
match before the draft is published. Existing matching tags/releases are
reused; incompatible state fails without force-push, deletion, or replacement.

Use `--dry-run` for read-only Git/GitHub preflight, `--yes` when artifact
approval occurred outside the interactive command, and `--publish-only` to
publish already-built assets from an existing remote tag. Setting `draft: true`
leaves the verified release as a draft. Setting `signTag: false` creates an
annotated unsigned tag instead of the signed default.

When `generateNotes` is `true` and `notes` is omitted, the release body is a
simple `## Changes` list of commit subjects since the previous Git tag. An
explicit `notes` value takes precedence.

## Hooks

Supported hooks are `beforeSetup`, `afterSetup`, `beforeCompile`, `afterCompile`, `beforePackage`, `afterPackage`, `beforeMsi`, `afterMsi`, `beforeBuild`, `afterBuild`, `beforeRelease`, and `afterRelease`.

Each hook is an array of `{ command, args?, cwd?, env? }`. Commands run directly with argument arrays and no shell. Relative `cwd` values resolve from the project root; `env` extends the current process environment.

## Template variables

Templates are supported in `compile.replacements` values; portable `output`, `from`, and `to` values; WiX `source`, `output`, and definition values; and release `tag`, `title`, `notes`, `commitMessage`, and asset values. Available variables are `${packageName}`, `${packageVersion}`, `${appName}`, `${artifactName}`, `${executable}`, `${projectRoot}`, `${buildDir}`, `${distDir}`, and `${workDir}`. Unknown variables are preserved for consumer tools.
