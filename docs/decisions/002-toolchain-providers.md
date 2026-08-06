# ADR 002: Toolchain providers

Status: accepted

The default managed provider downloads pinned upstream archives and verifies SHA-256. The npm package does not redistribute AutoHotkey, Ahk2Exe, UPX, or WiX binaries. A system provider supports explicit paths and PATH resolution. Builds never resolve an unpinned latest release.
