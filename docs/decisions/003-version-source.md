# ADR 003: Application version source

Status: accepted

The consumer's `package.json.version` is the sole default application version. It feeds generated AHK metadata, executable resources, archive names, WiX definitions, and release templates. Commands do not accept a competing version argument.
