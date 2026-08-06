import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_AHK2EXE, DEFAULT_AUTOHOTKEY, DEFAULT_UPX } from "../config/defaults.js";
import type { ManagedToolSpec, ManagedToolchainConfig, ResolvedConfig } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import { ensureDirectory, pathExists } from "../core/fs.js";
import type { Logger } from "../core/logger.js";
import { extractZip, findFileByBasename } from "./archive.js";
import { downloadAndVerify } from "./download.js";
import type { ResolveToolchainOptions, ToolchainPaths } from "./provider.js";

interface ResolvedSpecs {
  autoHotkey: ManagedToolSpec;
  ahk2exe: ManagedToolSpec;
  upx?: ManagedToolSpec;
}

export async function resolveManagedToolchain(
  config: ResolvedConfig,
  logger: Logger,
  options: ResolveToolchainOptions,
): Promise<ToolchainPaths> {
  if (process.platform !== "win32") {
    throw new AhkBuildError(
      "WINDOWS_REQUIRED",
      "The managed AutoHotkey toolchain can only be installed or executed on Windows.",
    );
  }

  const specs = resolveSpecs(config);
  const key = crypto.createHash("sha256").update(JSON.stringify(specs)).digest("hex").slice(0, 16);
  const toolchainDirectory = path.join(config.directories.cache, "toolchains", key);
  const paths: ToolchainPaths = {
    autoHotkey: path.join(toolchainDirectory, path.basename(specs.autoHotkey.executable)),
    ahk2exe: path.join(toolchainDirectory, path.basename(specs.ahk2exe.executable)),
    ...(specs.upx
      ? { upx: path.join(toolchainDirectory, path.basename(specs.upx.executable)) }
      : {}),
  };

  if (!options.force && (await toolchainExists(paths))) return paths;
  if (!options.install) {
    throw new AhkBuildError(
      "TOOLCHAIN_NOT_INSTALLED",
      "Managed toolchain is not installed. Run `ahk-build setup` first.",
    );
  }

  const downloadsDirectory = path.join(config.directories.cache, "downloads");
  const stagingDirectory = path.join(config.directories.cache, "staging", key);

  await fs.rm(stagingDirectory, { force: true, recursive: true });
  await ensureDirectory(stagingDirectory);
  await ensureDirectory(toolchainDirectory);

  await installTool(
    specs.autoHotkey,
    paths.autoHotkey,
    downloadsDirectory,
    stagingDirectory,
    logger,
    options.force,
  );
  await installTool(
    specs.ahk2exe,
    paths.ahk2exe,
    downloadsDirectory,
    stagingDirectory,
    logger,
    options.force,
  );
  if (specs.upx && paths.upx) {
    await installTool(
      specs.upx,
      paths.upx,
      downloadsDirectory,
      stagingDirectory,
      logger,
      options.force,
    );
  }

  await fs.writeFile(
    path.join(toolchainDirectory, "manifest.json"),
    `${JSON.stringify({ specs, installedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  await fs.rm(stagingDirectory, { force: true, recursive: true });
  logger.success(`Managed toolchain installed in ${toolchainDirectory}`);

  return paths;
}

function resolveSpecs(config: ResolvedConfig): ResolvedSpecs {
  const toolchain = config.toolchain as ManagedToolchainConfig;
  const runtimeExecutable =
    toolchain.autoHotkey?.executable ??
    (config.compile.architecture === "x86" ? "AutoHotkey32.exe" : "AutoHotkey64.exe");

  const autoHotkey = resolveToolSpec(DEFAULT_AUTOHOTKEY, {
    ...toolchain.autoHotkey,
    executable: runtimeExecutable,
  });
  const ahk2exe = resolveToolSpec(DEFAULT_AHK2EXE, toolchain.ahk2exe);
  const upx =
    config.compile.compression === "upx" && toolchain.upx !== false
      ? resolveToolSpec(DEFAULT_UPX, toolchain.upx)
      : undefined;

  return { autoHotkey, ahk2exe, ...(upx ? { upx } : {}) };
}

function resolveToolSpec(
  defaults: ManagedToolSpec,
  override: Partial<ManagedToolSpec> | undefined,
): ManagedToolSpec {
  const defined: Partial<ManagedToolSpec> = {};
  for (const key of Object.keys(override ?? {}) as (keyof ManagedToolSpec)[]) {
    const value = override?.[key];
    if (value !== undefined) defined[key] = value;
  }
  return { ...defaults, ...defined };
}

async function installTool(
  spec: ManagedToolSpec,
  output: string,
  downloadsDirectory: string,
  stagingRoot: string,
  logger: Logger,
  force = false,
): Promise<void> {
  const archive = await downloadAndVerify(spec, downloadsDirectory, logger, force);
  const executableName = path.basename(spec.executable);
  const extractionDirectory = path.join(stagingRoot, executableName.replace(/\.exe$/i, ""));
  await extractZip(archive, extractionDirectory);

  const executable = await findFileByBasename(extractionDirectory, executableName);
  if (!executable) {
    throw new AhkBuildError(
      "TOOL_NOT_FOUND_IN_ARCHIVE",
      `Could not find ${executableName} inside ${archive}`,
    );
  }

  await fs.copyFile(executable, output);
  logger.success(`${executableName} ${spec.version}`);
}

async function toolchainExists(paths: ToolchainPaths): Promise<boolean> {
  return (
    (await pathExists(paths.autoHotkey)) &&
    (await pathExists(paths.ahk2exe)) &&
    (!paths.upx || (await pathExists(paths.upx)))
  );
}
