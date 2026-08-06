import type { ResolvedConfig } from "../config/types.js";
import { compileProject } from "../compile/compile.js";
import { runHooks } from "../core/hooks.js";
import type { Logger } from "../core/logger.js";

export async function compileCommand(config: ResolvedConfig, logger: Logger): Promise<string> {
  await runHooks(config, "beforeCompile", logger);
  const output = await compileProject(config, logger);
  await runHooks(config, "afterCompile", logger);
  return output;
}
