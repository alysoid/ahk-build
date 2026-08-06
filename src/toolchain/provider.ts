import type { ResolvedConfig } from "../config/types.js";
import type { Logger } from "../core/logger.js";
import { resolveManagedToolchain } from "./managed-provider.js";
import { resolveSystemToolchain } from "./system-provider.js";

export interface ToolchainPaths {
  autoHotkey: string;
  ahk2exe: string;
  upx?: string;
}

export interface ResolveToolchainOptions {
  install?: boolean;
  force?: boolean;
}

export async function resolveToolchain(
  config: ResolvedConfig,
  logger: Logger,
  options: ResolveToolchainOptions = {},
): Promise<ToolchainPaths> {
  if (config.toolchain.provider === "system") {
    return resolveSystemToolchain(config, logger);
  }

  return resolveManagedToolchain(config, logger, options);
}
