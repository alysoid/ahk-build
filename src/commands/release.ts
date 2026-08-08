import { createInterface } from "node:readline/promises";

import type { ResolvedConfig } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import { runHooks } from "../core/hooks.js";
import type { Logger } from "../core/logger.js";
import {
  captureProcess,
  runProcess,
  type CaptureProcessRunner,
  type ProcessRunner,
} from "../core/process.js";
import {
  assertGitHubAuthentication,
  createGitHubRelease,
  resolveGitHubRelease,
} from "../release/github.js";
import {
  applyReleaseVersion,
  assertReleaseWorktree,
  commitTagAndPush,
  inspectGitRelease,
  writePackageVersion,
} from "../release/git.js";
import { buildCommand } from "./build.js";

export interface ReleaseCommandOptions {
  version?: string;
  dryRun?: boolean;
  yes?: boolean;
  publishOnly?: boolean;
}

interface ReleaseCommandDependencies {
  run?: ProcessRunner;
  capture?: CaptureProcessRunner;
  build?: typeof buildCommand;
  confirm?: (message: string) => Promise<boolean>;
}

export async function releaseCommand(
  sourceConfig: ResolvedConfig,
  logger: Logger,
  options: ReleaseCommandOptions = {},
  dependencies: ReleaseCommandDependencies = {},
): Promise<void> {
  const run = dependencies.run ?? runProcess;
  const capture = dependencies.capture ?? captureProcess;
  const build = dependencies.build ?? buildCommand;
  const confirm = dependencies.confirm ?? confirmRelease;

  if (options.publishOnly) {
    if (options.version) {
      throw new AhkBuildError(
        "UNEXPECTED_RELEASE_VERSION",
        "--publish-only does not accept a version.",
      );
    }
    const release = await resolveGitHubRelease(sourceConfig);
    await assertGitHubAuthentication(sourceConfig, run);
    logger.info(
      `Publish-only ${release.repository}@${release.tag}: ${release.assets.map((asset) => asset.name).join(", ")}`,
    );
    if (options.dryRun) return;

    await runHooks(sourceConfig, "beforeRelease", logger);
    await requireConfirmation(options.yes, confirm, `Publish ${release.tag} to GitHub?`);
    await createGitHubRelease(sourceConfig, logger, run, capture);
    await runHooks(sourceConfig, "afterRelease", logger);
    return;
  }

  const prepared = applyReleaseVersion(sourceConfig, options.version);
  const config = prepared.config;
  const git = await inspectGitRelease(
    config,
    prepared.versionChanged,
    options.version !== undefined,
    capture,
  );
  await assertGitHubAuthentication(config, run);
  logger.info(
    `Release ${git.tag} from ${git.branch} (${git.commitsAhead} unpushed commit${git.commitsAhead === 1 ? "" : "s"}).`,
  );
  if (options.dryRun) {
    logger.info("Dry run: version, build, Git and GitHub were not modified.");
    return;
  }

  if (git.versionChanged) await writePackageVersion(config);
  await build(config, logger);
  await assertReleaseWorktree(config, git.versionChanged, capture);
  const release = await resolveGitHubRelease(config);
  await runHooks(config, "beforeRelease", logger);
  await assertReleaseWorktree(config, git.versionChanged, capture);
  await requireConfirmation(
    options.yes,
    confirm,
    `Confirm the ${release.assets.length} release asset${release.assets.length === 1 ? "" : "s"} were tested and publish ${release.tag}?`,
  );
  await commitTagAndPush(config, git, logger, run, capture);
  await createGitHubRelease(config, logger, run, capture);
  await runHooks(config, "afterRelease", logger);
}

async function requireConfirmation(
  confirmed: boolean | undefined,
  confirm: (message: string) => Promise<boolean>,
  message: string,
): Promise<void> {
  if (confirmed) return;
  if (!(await confirm(message))) {
    throw new AhkBuildError("RELEASE_CANCELLED", "Release cancelled before remote changes.");
  }
}

async function confirmRelease(message: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new AhkBuildError(
      "RELEASE_CONFIRMATION_REQUIRED",
      "Release requires an interactive confirmation or --yes.",
    );
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(?:es)?$/i.test((await prompt.question(`${message} [y/N] `)).trim());
  } finally {
    prompt.close();
  }
}
