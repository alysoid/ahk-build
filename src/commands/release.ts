import type { ResolvedConfig } from "../config/types.js";
import { runHooks } from "../core/hooks.js";
import type { Logger } from "../core/logger.js";
import { createGitHubRelease } from "../release/github.js";

export async function releaseCommand(config: ResolvedConfig, logger: Logger): Promise<void> {
  await runHooks(config, "beforeRelease", logger);
  await createGitHubRelease(config, logger);
  await runHooks(config, "afterRelease", logger);
}
