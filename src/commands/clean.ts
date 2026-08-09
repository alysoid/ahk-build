import fs from "node:fs/promises";

import type { ResolvedConfig } from "../config/types.js";
import { assertSafeDeletionTarget } from "../core/fs.js";
import type { Logger } from "../core/logger.js";

export async function cleanCommand(
  config: ResolvedConfig,
  logger: Logger,
  includeCache = false,
): Promise<void> {
  const targets = [config.directories.build, config.directories.dist, config.directories.work];
  if (includeCache) targets.push(config.directories.cache);

  for (const target of targets) assertSafeDeletionTarget(target, config.root);
  await Promise.all(targets.map((target) => fs.rm(target, { force: true, recursive: true })));
  logger.success(`Removed ${targets.join(", ")}`);
}
