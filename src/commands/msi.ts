import type { ResolvedConfig } from "../config/types.js";
import { runHooks } from "../core/hooks.js";
import type { Logger } from "../core/logger.js";
import { buildMsi } from "../wix/build-msi.js";

export async function msiCommand(config: ResolvedConfig, logger: Logger): Promise<string> {
  await runHooks(config, "beforeMsi", logger);
  const output = await buildMsi(config, logger);
  await runHooks(config, "afterMsi", logger);
  return output;
}
