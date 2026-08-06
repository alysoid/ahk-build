import type { ResolvedConfig } from "../config/types.js";
import { runHooks } from "../core/hooks.js";
import type { Logger } from "../core/logger.js";
import { createPortableZip } from "../package/zip.js";

export async function packageCommand(config: ResolvedConfig, logger: Logger): Promise<string> {
  await runHooks(config, "beforePackage", logger);
  const output = await createPortableZip(config, logger);
  await runHooks(config, "afterPackage", logger);
  return output;
}
