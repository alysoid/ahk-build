import fs from "node:fs/promises";
import path from "node:path";

import type { ResolvedConfig, SystemToolchainConfig } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import { pathExists, resolveFrom } from "../core/fs.js";
import type { Logger } from "../core/logger.js";
import type { ToolchainPaths } from "./provider.js";

export async function resolveSystemToolchain(
  config: ResolvedConfig,
  logger: Logger,
): Promise<ToolchainPaths> {
  if (process.platform !== "win32") {
    throw new AhkBuildError("WINDOWS_REQUIRED", "AutoHotkey compilation requires Windows.");
  }

  const toolchain = config.toolchain as SystemToolchainConfig;
  const autoHotkey = await resolveExecutable(toolchain.autoHotkey, config.root);
  const ahk2exe = await resolveExecutable(toolchain.ahk2exe, config.root);
  const upx = toolchain.upx ? await resolveExecutable(toolchain.upx, config.root) : undefined;

  logger.debug(`AutoHotkey: ${autoHotkey}`);
  logger.debug(`Ahk2Exe: ${ahk2exe}`);
  if (upx) logger.debug(`UPX: ${upx}`);

  return { autoHotkey, ahk2exe, ...(upx ? { upx } : {}) };
}

async function resolveExecutable(value: string, root: string): Promise<string> {
  const candidate = resolveFrom(root, value);
  if (await pathExists(candidate)) return candidate;

  const pathValue = process.env.PATH ?? "";
  const extensions = process.env.PATHEXT?.split(";") ?? [".EXE", ".CMD", ".BAT", ""];
  const hasExtension = path.extname(value).length > 0;

  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) continue;
    for (const extension of hasExtension ? [""] : extensions) {
      const executable = path.join(directory, `${value}${extension}`);
      try {
        const stat = await fs.stat(executable);
        if (stat.isFile()) return executable;
      } catch {
        // Continue searching PATH.
      }
    }
  }

  throw new AhkBuildError("TOOL_NOT_FOUND", `Executable not found: ${value}`);
}
