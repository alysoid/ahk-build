# ADR 004: WiX ownership

Status: accepted

WiX support is optional orchestration. Consumer repositories own `.wxs` files and all installer identity and behavior. The package validates inputs, supplies stable preprocessor definitions, invokes WiX, and verifies the output.
