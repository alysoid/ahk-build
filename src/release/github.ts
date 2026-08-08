import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import type { ResolvedConfig } from "../config/types.js";
import { getMsiOutput, getPortableOutput } from "../core/artifacts.js";
import { AhkBuildError } from "../core/errors.js";
import { ensureFile, resolveFrom } from "../core/fs.js";
import type { Logger } from "../core/logger.js";
import { createTemplateContext } from "../core/project.js";
import {
  captureProcess,
  runProcess,
  type CaptureProcessRunner,
  type ProcessRunner,
} from "../core/process.js";
import { interpolate } from "../core/template.js";

interface ReleaseAsset {
  path: string;
  name: string;
  size: number;
  digest: string;
}

export interface GitHubReleasePlan {
  repository: string;
  tag: string;
  title: string;
  notes: string;
  assets: ReleaseAsset[];
  draft: boolean;
  prerelease: boolean;
}

const remoteReleaseSchema = z.object({
  tagName: z.string(),
  isDraft: z.boolean(),
  isPrerelease: z.boolean(),
  assets: z.array(
    z.object({
      name: z.string(),
      size: z.number(),
      digest: z.string().optional(),
    }),
  ),
});

type RemoteRelease = z.infer<typeof remoteReleaseSchema>;

export async function resolveGitHubRelease(config: ResolvedConfig): Promise<GitHubReleasePlan> {
  if (!config.release) {
    throw new AhkBuildError("RELEASE_DISABLED", "GitHub release publishing is not configured.");
  }

  const context = createTemplateContext(config);
  const version = config.packageMetadata.version;
  const tag = interpolate(config.release.tag ?? "v${packageVersion}", context);
  const paths = (config.release.assets ?? defaultAssets(config)).map((asset) =>
    resolveFrom(config.root, interpolate(asset, context)),
  );
  if (paths.length === 0) {
    throw new AhkBuildError("NO_RELEASE_ASSETS", "No release assets are configured.");
  }

  const basenames = new Set<string>();
  const assets: ReleaseAsset[] = [];
  for (const assetPath of paths) {
    await ensureFile(assetPath, "release asset");
    const name = path.basename(assetPath);
    const normalizedName = name.toLowerCase();
    if (basenames.has(normalizedName)) {
      throw new AhkBuildError(
        "DUPLICATE_RELEASE_ASSET",
        `Multiple release assets use the basename ${name}`,
      );
    }
    basenames.add(normalizedName);
    const content = await fs.readFile(assetPath);
    assets.push({
      path: assetPath,
      name,
      size: content.byteLength,
      digest: `sha256:${createHash("sha256").update(content).digest("hex")}`,
    });
  }

  return {
    repository: config.release.repository,
    tag,
    title: interpolate(config.release.title ?? `Release v${version}`, context),
    notes: interpolate(config.release.notes ?? `Release version ${version}`, context),
    assets,
    draft: config.release.draft ?? false,
    prerelease: config.release.prerelease ?? false,
  };
}

export async function assertGitHubAuthentication(
  config: ResolvedConfig,
  run: ProcessRunner = runProcess,
): Promise<void> {
  await run("gh", ["auth", "status"], { cwd: config.root, stdio: "pipe" });
}

export async function createGitHubRelease(
  config: ResolvedConfig,
  logger: Logger,
  run: ProcessRunner = runProcess,
  capture: CaptureProcessRunner = captureProcess,
): Promise<void> {
  const plan = await resolveGitHubRelease(config);
  await assertGitHubAuthentication(config, run);

  let remote = await readRemoteRelease(config, plan, capture);
  if (!remote) {
    logger.info(`Creating GitHub release ${plan.repository}@${plan.tag}...`);
    await run(
      "gh",
      [
        "release",
        "create",
        plan.tag,
        ...plan.assets.map((asset) => asset.path),
        "--repo",
        plan.repository,
        "--verify-tag",
        "--title",
        plan.title,
        "--notes",
        plan.notes,
        "--draft",
        ...(plan.prerelease ? ["--prerelease"] : []),
      ],
      { cwd: config.root },
    );
    remote = await readRemoteRelease(config, plan, capture);
    if (!remote) {
      throw new AhkBuildError(
        "RELEASE_VERIFICATION_FAILED",
        `GitHub release ${plan.tag} was not found after creation.`,
      );
    }
  }

  verifyRemoteRelease(plan, remote);
  if (plan.draft) {
    if (!remote.isDraft) {
      throw new AhkBuildError(
        "RELEASE_STATE_MISMATCH",
        `GitHub release ${plan.tag} is already published, but draft mode is configured.`,
      );
    }
    logger.success(`Verified draft release ${plan.tag}`);
    return;
  }

  if (remote.isDraft) {
    await run("gh", ["release", "edit", plan.tag, "--repo", plan.repository, "--draft=false"], {
      cwd: config.root,
    });
    remote = await readRemoteRelease(config, plan, capture);
    if (!remote || remote.isDraft) {
      throw new AhkBuildError(
        "RELEASE_VERIFICATION_FAILED",
        `GitHub release ${plan.tag} was not published.`,
      );
    }
    verifyRemoteRelease(plan, remote);
  }

  logger.success(`Published and verified ${plan.tag}`);
}

async function readRemoteRelease(
  config: ResolvedConfig,
  plan: GitHubReleasePlan,
  capture: CaptureProcessRunner,
): Promise<RemoteRelease | undefined> {
  const result = await capture(
    "gh",
    [
      "release",
      "view",
      plan.tag,
      "--repo",
      plan.repository,
      "--json",
      "tagName,isDraft,isPrerelease,assets",
    ],
    { cwd: config.root },
  );
  if (result.exitCode !== 0) return undefined;

  let value: unknown;
  try {
    value = JSON.parse(result.stdout) as unknown;
  } catch (error) {
    throw new AhkBuildError(
      "INVALID_RELEASE_RESPONSE",
      `GitHub returned invalid release data for ${plan.tag}.`,
      { cause: error },
    );
  }
  const parsed = remoteReleaseSchema.safeParse(value);
  if (!parsed.success) {
    throw new AhkBuildError(
      "INVALID_RELEASE_RESPONSE",
      `GitHub returned invalid release data for ${plan.tag}.`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

function verifyRemoteRelease(plan: GitHubReleasePlan, remote: RemoteRelease): void {
  if (remote.tagName !== plan.tag || remote.isPrerelease !== plan.prerelease) {
    throw new AhkBuildError(
      "RELEASE_STATE_MISMATCH",
      `GitHub release ${plan.tag} has incompatible tag or prerelease state.`,
    );
  }

  const expected = [...plan.assets].sort((left, right) => left.name.localeCompare(right.name));
  const actual = [...remote.assets].sort((left, right) => left.name.localeCompare(right.name));
  if (
    actual.length !== expected.length ||
    expected.some((asset, index) => {
      const uploaded = actual[index];
      if (!uploaded) return true;
      return (
        uploaded.name !== asset.name ||
        uploaded.size !== asset.size ||
        uploaded.digest !== asset.digest
      );
    })
  ) {
    throw new AhkBuildError(
      "RELEASE_ASSET_MISMATCH",
      `GitHub release ${plan.tag} assets do not match the local build.`,
    );
  }
}

function defaultAssets(config: ResolvedConfig): string[] {
  return [
    ...(config.portable ? [getPortableOutput(config)] : []),
    ...(config.wix ? [getMsiOutput(config)] : []),
  ];
}
