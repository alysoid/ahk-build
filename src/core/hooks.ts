import type { HookName, ResolvedConfig } from "../config/types.js";
import type { Logger } from "./logger.js";
import { runCommandSpec } from "./process.js";

export async function runHooks(
  config: ResolvedConfig,
  hook: HookName,
  logger: Logger,
): Promise<void> {
  for (const command of config.hooks?.[hook] ?? []) {
    await runCommandSpec(command, config.root, logger);
  }
}
