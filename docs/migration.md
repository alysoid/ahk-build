# Consumer migration checklist

1. Add `package.json.version` and make it the sole application version.
2. Install `@alysoid/ahk-build` and create `ahk-build.config.ts`.
3. Move standard Ahk2Exe metadata and resource declarations into `app`.
4. Keep application-specific icon generation in a local npm script and call it through `beforeCompile`.
5. Define portable files explicitly and compare archive contents with the previous release.
6. Adapt the `.wxs` file to read `$(ProductVersion)` and build paths supplied by the package.
7. Replace the previous build commands with package scripts.
8. Run `doctor`, `build`, and a clean-machine smoke test.
9. Compare EXE version resources, ZIP contents, MSI install/upgrade/uninstall behavior, and release assets before deleting the old workflow.
