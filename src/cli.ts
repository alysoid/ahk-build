#!/usr/bin/env node

import fs from "node:fs/promises";

import { buildCommand } from "./commands/build.js";
import { cleanCommand } from "./commands/clean.js";
import { compileCommand } from "./commands/compile.js";
import { doctorCommand } from "./commands/doctor.js";
import { msiCommand } from "./commands/msi.js";
import { packageCommand } from "./commands/package.js";
import { releaseCommand } from "./commands/release.js";
import { setupCommand } from "./commands/setup.js";
import { runProject } from "./compile/run.js";
import { loadConfig } from "./config/load-config.js";
import { AhkBuildError, toError } from "./core/errors.js";
import { createLogger } from "./core/logger.js";

interface ParsedArguments {
  command?: string;
  cwd?: string;
  config?: string;
  verbose: boolean;
  force: boolean;
  includeCache: boolean;
  forwarded: string[];
}

const HELP = `@alysoid/ahk-build

Usage:
  ahk-build <command> [options] [-- forwarded arguments]

Commands:
  doctor      Validate the project and report toolchain status
  setup       Download and verify the managed toolchain
  run         Run the AutoHotkey entry script
  clean       Remove generated project artifacts
  compile     Compile the AutoHotkey script to an executable
  zip         Create the configured deterministic portable archive
  msi         Build the optional WiX installer
  build       Clean, compile, and create enabled artifacts
  release     Publish configured artifacts with GitHub CLI

Options:
  --cwd <dir>       Project root (default: current directory)
  --config <file>   Explicit configuration path
  --verbose         Include debug details
  --force           Reinstall managed toolchain during setup
  --cache           Also remove the shared cache during clean
  -h, --help        Show help
  -v, --version     Show package version
`;

async function main(): Promise<void> {
  const parsed = parseArguments(process.argv.slice(2));
  if (!parsed.command || parsed.command === "help" || parsed.command === "--help") {
    console.log(HELP);
    return;
  }
  if (parsed.command === "--version" || parsed.command === "-v") {
    console.log(await getVersion());
    return;
  }

  const logger = createLogger(parsed.verbose);
  const loadOptions = {
    ...(parsed.cwd ? { cwd: parsed.cwd } : {}),
    ...(parsed.config ? { configPath: parsed.config } : {}),
  };
  const config = await loadConfig(loadOptions);

  switch (parsed.command) {
    case "doctor":
      await doctorCommand(config, logger);
      break;
    case "setup":
      await setupCommand(config, logger, parsed.force);
      break;
    case "run":
      await runProject(config, logger, parsed.forwarded);
      break;
    case "clean":
      await cleanCommand(config, logger, parsed.includeCache);
      break;
    case "compile":
      await compileCommand(config, logger);
      break;
    case "zip":
    case "package":
      await packageCommand(config, logger);
      break;
    case "msi":
      await msiCommand(config, logger);
      break;
    case "build":
      await buildCommand(config, logger);
      break;
    case "release":
      await releaseCommand(config, logger);
      break;
    default:
      throw new AhkBuildError("UNKNOWN_COMMAND", `Unknown command: ${parsed.command}`);
  }
}

function parseArguments(args: string[]): ParsedArguments {
  const separator = args.indexOf("--");
  const ownArgs = separator === -1 ? args : args.slice(0, separator);
  const forwarded = separator === -1 ? [] : args.slice(separator + 1);
  const result: ParsedArguments = {
    verbose: false,
    force: false,
    includeCache: false,
    forwarded,
  };

  for (let index = 0; index < ownArgs.length; index += 1) {
    const value = ownArgs[index];
    if (!value) continue;

    if (value === "--cwd" || value === "--config") {
      const next = ownArgs[index + 1];
      if (!next) throw new AhkBuildError("MISSING_OPTION_VALUE", `${value} requires a value.`);
      if (value === "--cwd") result.cwd = next;
      else result.config = next;
      index += 1;
      continue;
    }
    if (value === "--verbose") result.verbose = true;
    else if (value === "--force") result.force = true;
    else if (value === "--cache") result.includeCache = true;
    else if (value === "-h" || value === "--help") result.command = "help";
    else if (!result.command) result.command = value;
    else throw new AhkBuildError("UNEXPECTED_ARGUMENT", `Unexpected argument: ${value}`);
  }

  return result;
}

async function getVersion(): Promise<string> {
  const packagePath = new URL("../package.json", import.meta.url);
  const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8")) as { version: string };
  return packageJson.version;
}

main().catch((value: unknown) => {
  const error = toError(value);
  const code = error instanceof AhkBuildError ? error.code : "UNEXPECTED_ERROR";
  console.error(`ERROR [${code}] ${error.message}`);
  if (process.argv.includes("--verbose") && error.cause instanceof Error) {
    console.error(error.cause.stack ?? error.cause.message);
  }
  process.exitCode = 1;
});
