# ADR 003: Application version source

Status: accepted

The consumer's `package.json.version` is the sole application version. It feeds generated AHK metadata, executable resources, archive names, WiX definitions, and release templates. As accepted in ADR 005, `release [version]` may update this field before building; downstream commands still read only `package.json` and never receive a competing version.
