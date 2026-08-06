import type { ResolvedConfig } from "../config/types.js";
import { runHooks } from "../core/hooks.js";
import type { Logger } from "../core/logger.js";
import { cleanCommand } from "./clean.js";
import { compileCommand } from "./compile.js";
import { msiCommand } from "./msi.js";
import { packageCommand } from "./package.js";

export async function buildCommand(config: ResolvedConfig, logger: Logger): Promise<void> {
  await runHooks(config, "beforeBuild", logger);
  await cleanCommand(config, logger);
  await compileCommand(config, logger);
  if (config.portable) await packageCommand(config, logger);
  if (config.wix) await msiCommand(config, logger);
  await runHooks(config, "afterBuild", logger);
}
