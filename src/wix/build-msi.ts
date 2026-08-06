import path from "node:path";

import type { ResolvedConfig } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import { getMsiOutput } from "../core/artifacts.js";
import { ensureDirectory, ensureFile, resolveFrom } from "../core/fs.js";
import type { Logger } from "../core/logger.js";
import { createTemplateContext } from "../core/project.js";
import { runProcess } from "../core/process.js";
import { interpolate } from "../core/template.js";

export async function buildMsi(config: ResolvedConfig, logger: Logger): Promise<string> {
  if (!config.wix) {
    throw new AhkBuildError("WIX_DISABLED", "WiX packaging is not configured.");
  }
  if (process.platform !== "win32") {
    throw new AhkBuildError("WINDOWS_REQUIRED", "WiX MSI builds require Windows.");
  }

  const context = createTemplateContext(config);
  const source = resolveFrom(config.root, interpolate(config.wix.source, context));
  const output = getMsiOutput(config);
  await ensureFile(source, "WiX source file");
  await ensureDirectory(path.dirname(output));

  const defines = {
    ProductVersion: config.packageMetadata.version,
    ProjectRoot: config.root,
    BuildDir: config.directories.build,
    DistDir: config.directories.dist,
    ...config.wix.defines,
  };

  const args = [
    "build",
    source,
    "-arch",
    config.wix.architecture ?? config.compile.architecture,
    "-out",
    output,
    ...Object.entries(defines).flatMap(([name, value]) => [
      "-d",
      `${name}=${interpolate(value, context)}`,
    ]),
    ...(config.wix.extensions ?? []).flatMap((extension) => ["-ext", extension]),
    ...(config.wix.additionalArgs ?? []),
  ];

  logger.info(`Building MSI from ${path.basename(source)}...`);
  await runProcess(config.wix.executable ?? "wix", args, { cwd: config.root });
  await ensureFile(output, "MSI artifact");
  logger.success(`Created ${output}`);
  return output;
}
