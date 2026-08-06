import type { ResolvedConfig } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import { ensureFile, resolveFrom } from "../core/fs.js";
import type { Logger } from "../core/logger.js";
import { resolveToolchain } from "../toolchain/provider.js";

export async function doctorCommand(config: ResolvedConfig, logger: Logger): Promise<void> {
  await ensureFile(resolveFrom(config.root, config.entry), "AutoHotkey entry file");
  if (config.app.icon)
    await ensureFile(resolveFrom(config.root, config.app.icon), "application icon");
  for (const resource of config.app.resources ?? []) {
    await ensureFile(resolveFrom(config.root, resource.source), `resource ${resource.id}`);
  }
  if (config.wix) await ensureFile(resolveFrom(config.root, config.wix.source), "WiX source file");

  logger.success(`Configuration: ${config.configPath}`);
  logger.success(`Package version: ${config.packageMetadata.version}`);

  if (process.platform !== "win32") {
    logger.warn("Windows-only commands were not checked on this platform.");
    return;
  }

  try {
    const toolchain = await resolveToolchain(config, logger, { install: false });
    logger.success(`AutoHotkey: ${toolchain.autoHotkey}`);
    logger.success(`Ahk2Exe: ${toolchain.ahk2exe}`);
    if (config.compile.compression === "upx") {
      if (!toolchain.upx) throw new AhkBuildError("UPX_NOT_CONFIGURED", "UPX is not configured.");
      logger.success(`UPX: ${toolchain.upx}`);
    }
  } catch (error) {
    if (error instanceof AhkBuildError && error.code === "TOOLCHAIN_NOT_INSTALLED") {
      logger.warn(error.message);
      return;
    }
    throw error;
  }
}
