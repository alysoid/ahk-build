# Toolchain model

The managed provider is the default. It uses pinned upstream archive URLs and SHA-256 hashes, stores downloads in a shared cache, and materializes a version-keyed toolchain. It never publishes third-party executables inside the npm package.

The system provider accepts explicit executables. Relative paths resolve from the consumer root; otherwise the provider searches `PATH`. This supports Scoop, manually installed binaries, development builds, and controlled corporate environments without special provider code.

The cache default is `%LOCALAPPDATA%\\ahk-build\\cache` on Windows and the platform cache directory elsewhere. `AHK_BUILD_CACHE_DIR` overrides it globally. A project can override it with `directories.cache`.

Updating managed defaults requires checking upstream release provenance and SHA-256 values, adding or updating tests, and documenting the change. Never resolve `latest` during an application build.
