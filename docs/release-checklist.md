# Release checklist

This checklist publishes `@alysoid/ahk-build` from a clean GitHub tag. The
first release is `0.1.0` and its canonical tag is `v0.1.0`.

## Prerequisites

- The repository has a committed `main` branch and the `origin` remote points
  to `https://github.com/alysoid/ahk-build`.
- The GitHub repository is public and the owner can create releases.
- Node.js 24, Corepack, pnpm 11.20.0, and npm CLI 11.5.1 or newer are
  available in local checks.
- The npm owner has access to `@alysoid/ahk-build` and has configured the
  GitHub Actions Trusted Publisher for organization `alysoid`, repository
  `ahk-build`, and workflow filename `publish.yml`.
- The Trusted Publisher allows `npm publish`, and the workflow can mint an
  OIDC token with `id-token: write`.
- GitHub Actions uses a GitHub-hosted runner. Self-hosted runners are not
  supported for npm Trusted Publishing.

Trusted Publishing configuration is external to this repository. Follow the
[npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/)
and verify that the repository and workflow filename match exactly.

## Pre-release checks

Run from a clean checkout:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm pack:check
```

`pnpm pack:check` removes the previous `.artifacts` contents, builds one
tarball and its SHA-256 checksum, and validates its manifest, ESM export,
TypeScript declaration entry, CLI entry point, and published file whitelist.

On Windows, run the real managed toolchain and external tarball smoke test:

```powershell
$env:AHK_BUILD_INTEGRATION = "1"
pnpm test
$env:AHK_BUILD_TARBALL_SMOKE_WINDOWS = "1"
node scripts/tarball-smoke.mjs .artifacts\alysoid-ahk-build-0.1.0.tgz
```

The smoke test installs that exact tarball into a temporary consumer outside
the repository, imports the ESM export, type-checks the declarations, invokes
the CLI, and on Windows runs `doctor`, `setup`, `compile`, and `zip`.

Verify the release tag before pushing it:

```powershell
node scripts/verify-release-tag.mjs v0.1.0
```

Do not publish a tarball different from the one validated by `pack:check`.

## Tag and automated publication

After the checks pass, create and push the annotated tag:

```powershell
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

`.github/workflows/publish.yml` then:

1. checks that the workflow is running in `alysoid/ahk-build`;
2. checks that `v${package.json.version}` equals the pushed tag;
3. installs the frozen lockfile and runs the checks;
4. builds one tarball and runs the external smoke test against that same file;
5. creates its checksum;
6. creates a draft GitHub Release with the tarball and checksum;
7. publishes that exact tarball to npm with provenance;
8. publishes the prepared GitHub Release and verifies its assets.

The workflow uses OIDC; it must not require an npm write token. Scoped public
packages require explicit public access on their first publication, which is
why the workflow passes `--access public`.

## Post-publication verification

```powershell
npm view @alysoid/ahk-build@0.1.0 version dist.tarball dist.integrity
npm audit signatures
gh release view v0.1.0 --repo alysoid/ahk-build --json tagName,isDraft,assets
gh release download v0.1.0 --repo alysoid/ahk-build --pattern "*.tgz" --pattern "*.sha256"
```

Compare the downloaded tarball checksum with the checksum asset. Confirm the
npm README, version, provenance badge, ESM import, CLI binary, and TypeScript
declarations from a fresh external consumer.

## Failure handling

- A tag/version mismatch fails before the GitHub Release or npm publish.
- Missing build outputs or smoke failures fail before publication.
- If npm publication fails after the draft release is created, leave the draft
  in place while diagnosing and rerun the workflow; do not delete it
  automatically.
- npm versions are immutable. A bad `0.1.0` publication cannot be replaced by
  republishing the same version; use a new version after correction.
- Do not delete a test or real release without explicit owner authorization.

## Consumer release command

`ahk-build release` is separate from this package workflow. It does not build
artifacts, verifies every configured asset before invoking GitHub CLI, rejects
duplicate asset basenames, and uses `--verify-tag` so a missing remote tag does
not get created implicitly.
