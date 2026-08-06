import type { ResolvedConfig } from "../config/types.js";
import { runHooks } from "../core/hooks.js";
import type { Logger } from "../core/logger.js";
import { resolveToolchain } from "../toolchain/provider.js";

export async function setupCommand(
  config: ResolvedConfig,
  logger: Logger,
  force = false,
): Promise<void> {
  await runHooks(config, "beforeSetup", logger);
  await resolveToolchain(config, logger, { install: true, force });
  await runHooks(config, "afterSetup", logger);
}
