import path from "node:path";

import type { ResolvedConfig } from "../config/types.js";
import { getMsiOutput, getPortableOutput } from "../core/artifacts.js";
import { AhkBuildError } from "../core/errors.js";
import { ensureFile, resolveFrom } from "../core/fs.js";
import type { Logger } from "../core/logger.js";
import { createTemplateContext } from "../core/project.js";
import { runProcess, type RunProcessOptions } from "../core/process.js";
import { interpolate } from "../core/template.js";

export type ReleaseProcessRunner = (
  command: string,
  args: string[],
  options: RunProcessOptions,
) => Promise<void>;

export async function createGitHubRelease(
  config: ResolvedConfig,
  logger: Logger,
  run: ReleaseProcessRunner = runProcess,
): Promise<void> {
  if (!config.release) {
    throw new AhkBuildError("RELEASE_DISABLED", "GitHub release publishing is not configured.");
  }

  const context = createTemplateContext(config);
  const version = config.packageMetadata.version;
  const tag = interpolate(config.release.tag ?? "v${packageVersion}", context);
  const title = interpolate(config.release.title ?? `Release v${version}`, context);
  const notes = interpolate(config.release.notes ?? `Release version ${version}`, context);
  const assets = (config.release.assets ?? defaultAssets(config)).map((asset) =>
    resolveFrom(config.root, interpolate(asset, context)),
  );

  if (assets.length === 0) {
    throw new AhkBuildError("NO_RELEASE_ASSETS", "No release assets are configured.");
  }
  const basenames = new Set<string>();
  for (const asset of assets) {
    await ensureFile(asset, "release asset");
    const basename = path.basename(asset).toLowerCase();
    if (basenames.has(basename)) {
      throw new AhkBuildError(
        "DUPLICATE_RELEASE_ASSET",
        `Multiple release assets use the basename ${path.basename(asset)}`,
      );
    }
    basenames.add(basename);
  }

  await run("gh", ["auth", "status"], { cwd: config.root, stdio: "pipe" });

  const args = [
    "release",
    "create",
    tag,
    ...assets,
    "--repo",
    config.release.repository,
    "--verify-tag",
    "--title",
    title,
    "--notes",
    notes,
    ...(config.release.draft ? ["--draft"] : []),
    ...(config.release.prerelease ? ["--prerelease"] : []),
  ];

  logger.info(`Creating GitHub release ${config.release.repository}@${tag}...`);
  await run("gh", args, { cwd: config.root });
  logger.success(`Published ${tag}`);
}

function defaultAssets(config: ResolvedConfig): string[] {
  return [
    ...(config.portable ? [getPortableOutput(config)] : []),
    ...(config.wix ? [getMsiOutput(config)] : []),
  ];
}
