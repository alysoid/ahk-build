import type { ResolvedConfig } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import { ensureFile, resolveFrom } from "../core/fs.js";
import type { Logger } from "../core/logger.js";
import { runProcess } from "../core/process.js";
import { resolveToolchain } from "../toolchain/provider.js";

export async function runProject(
  config: ResolvedConfig,
  logger: Logger,
  forwardedArgs: string[] = [],
): Promise<void> {
  if (process.platform !== "win32") {
    throw new AhkBuildError("WINDOWS_REQUIRED", "Running AutoHotkey scripts requires Windows.");
  }

  const entry = resolveFrom(config.root, config.entry);
  await ensureFile(entry, "AutoHotkey entry file");
  const toolchain = await resolveToolchain(config, logger, { install: true });
  await runProcess(toolchain.autoHotkey, [entry, ...forwardedArgs], { cwd: config.root });
}
