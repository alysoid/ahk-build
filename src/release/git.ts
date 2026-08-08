import fs from "node:fs/promises";

import type { ResolvedConfig } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import type { Logger } from "../core/logger.js";
import { createTemplateContext } from "../core/project.js";
import {
  captureProcess,
  runProcess,
  type CaptureProcessRunner,
  type ProcessRunner,
} from "../core/process.js";
import { interpolate } from "../core/template.js";

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export interface GitReleasePlan {
  branch: string;
  remote: string;
  remoteRef: string;
  tag: string;
  commitMessage: string;
  tagMessage: string;
  versionChanged: boolean;
  commitsAhead: number;
}

export function applyReleaseVersion(
  config: ResolvedConfig,
  requestedVersion?: string,
): { config: ResolvedConfig; versionChanged: boolean } {
  const version = requestedVersion ?? config.packageMetadata.version;
  if (!SEMVER.test(version)) {
    throw new AhkBuildError("INVALID_RELEASE_VERSION", `Invalid release version: ${version}`);
  }

  return {
    config: {
      ...config,
      packageMetadata: { ...config.packageMetadata, version },
    },
    versionChanged: version !== config.packageMetadata.version,
  };
}

export async function inspectGitRelease(
  config: ResolvedConfig,
  versionChanged: boolean,
  resumePreparedVersion = false,
  capture: CaptureProcessRunner = captureProcess,
): Promise<GitReleasePlan> {
  if (!config.release) {
    throw new AhkBuildError("RELEASE_DISABLED", "GitHub release publishing is not configured.");
  }

  const status = await readGit(
    config,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    capture,
  );
  if (status) {
    if (resumePreparedVersion && status === "M package.json") {
      const committed = await capture("git", ["show", "HEAD:package.json"], { cwd: config.root });
      if (committed.exitCode !== 0) {
        throw new AhkBuildError(
          "GIT_COMMAND_FAILED",
          committed.stderr.trim() || "Could not read the committed package.json.",
        );
      }
      const currentPackage = await fs.readFile(config.packagePath, "utf8");
      const expectedPackage = replacePackageVersion(
        committed.stdout,
        config.packageMetadata.version,
      ).replaceAll("\r\n", "\n");
      if (expectedPackage !== currentPackage.replaceAll("\r\n", "\n")) {
        throw new AhkBuildError("DIRTY_WORKTREE", "Release requires a clean Git worktree.");
      }
      versionChanged = true;
    } else {
      throw new AhkBuildError("DIRTY_WORKTREE", "Release requires a clean Git worktree.");
    }
  }

  const branch = await readGitMaybe(config, ["symbolic-ref", "--short", "HEAD"], capture);
  if (!branch) {
    throw new AhkBuildError("RELEASE_BRANCH_REQUIRED", "Release requires a checked-out branch.");
  }
  const remote = await readGitMaybe(
    config,
    ["config", "--get", `branch.${branch}.remote`],
    capture,
  );
  const remoteRef = await readGitMaybe(
    config,
    ["config", "--get", `branch.${branch}.merge`],
    capture,
  );
  if (!remote || !remoteRef?.startsWith("refs/heads/")) {
    throw new AhkBuildError("RELEASE_UPSTREAM_MISSING", `Branch ${branch} has no upstream.`);
  }
  const remoteUrl = await readGit(config, ["remote", "get-url", remote], capture);
  const githubRepository = /github\.com[/:]([^/:\s]+\/[^/\s]+?)(?:\.git)?$/i.exec(remoteUrl)?.[1];
  if (
    githubRepository &&
    githubRepository.toLowerCase() !== config.release.repository.toLowerCase()
  ) {
    throw new AhkBuildError(
      "RELEASE_REPOSITORY_MISMATCH",
      `Git remote ${remote} targets ${githubRepository}, not ${config.release.repository}.`,
    );
  }

  const head = await readGit(config, ["rev-parse", "HEAD"], capture);
  const remoteHead = firstGitField(
    await readGitMaybe(config, ["ls-remote", "--exit-code", remote, remoteRef], capture, 2),
  );
  if (!remoteHead) {
    throw new AhkBuildError(
      "RELEASE_UPSTREAM_MISSING",
      `Remote branch ${remote}/${branch} is missing.`,
    );
  }

  let commitsAhead = 0;
  if (head !== remoteHead) {
    if (versionChanged) {
      throw new AhkBuildError(
        "RELEASE_UPSTREAM_OUT_OF_DATE",
        `Branch ${branch} must match ${remote}/${branch} before preparing a release.`,
      );
    }
    const remoteCommit = await capture("git", ["cat-file", "-e", `${remoteHead}^{commit}`], {
      cwd: config.root,
    });
    if (remoteCommit.exitCode !== 0) {
      throw new AhkBuildError(
        "RELEASE_UPSTREAM_OUT_OF_DATE",
        `Branch ${branch} is behind or diverged from ${remote}/${branch}.`,
      );
    }
    const mergeBase = await readGit(config, ["merge-base", "HEAD", remoteHead], capture);
    if (mergeBase !== remoteHead) {
      throw new AhkBuildError(
        "RELEASE_UPSTREAM_OUT_OF_DATE",
        `Branch ${branch} must match ${remote}/${branch} before preparing a release.`,
      );
    }
    commitsAhead = Number(
      await readGit(config, ["rev-list", "--count", `${remoteHead}..HEAD`], capture),
    );
  }

  const context = createTemplateContext(config);
  const tag = interpolate(config.release.tag ?? "v${packageVersion}", context);
  const commitMessage = interpolate(
    config.release.commitMessage ?? "chore(release): prepare ${packageVersion}",
    context,
  );
  const tagMessage = interpolate(
    config.release.title ?? `Release v${config.packageMetadata.version}`,
    context,
  );
  const localTag = await readGitMaybe(
    config,
    ["rev-parse", "-q", "--verify", `refs/tags/${tag}^{}`],
    capture,
  );
  const remoteTag = await readRemoteTag(config, remote, tag, capture);

  if (localTag && localTag !== head) {
    throw new AhkBuildError("RELEASE_TAG_MISMATCH", `Local tag ${tag} points to another commit.`);
  }
  if (remoteTag && remoteTag !== head) {
    throw new AhkBuildError("RELEASE_TAG_MISMATCH", `Remote tag ${tag} points to another commit.`);
  }
  if (versionChanged && (localTag || remoteTag)) {
    throw new AhkBuildError("RELEASE_TAG_EXISTS", `Tag ${tag} already exists.`);
  }

  return {
    branch,
    remote,
    remoteRef,
    tag,
    commitMessage,
    tagMessage,
    versionChanged,
    commitsAhead,
  };
}

export async function writePackageVersion(config: ResolvedConfig): Promise<void> {
  const source = await fs.readFile(config.packagePath, "utf8");
  await fs.writeFile(
    config.packagePath,
    replacePackageVersion(source, config.packageMetadata.version),
  );
}

function replacePackageVersion(source: string, version: string): string {
  const packageJson = JSON.parse(source) as { version?: unknown };
  const match = /("version"\s*:\s*")([^"\\]*)(")/.exec(source);
  const prefix = match?.[1];
  const suffix = match?.[3];
  if (!match || !prefix || !suffix || match[2] !== packageJson.version) {
    throw new AhkBuildError(
      "PACKAGE_VERSION_NOT_EDITABLE",
      "Could not update the version field in package.json.",
    );
  }

  return (
    source.slice(0, match.index) +
    prefix +
    version +
    suffix +
    source.slice(match.index + match[0].length)
  );
}

export async function assertReleaseWorktree(
  config: ResolvedConfig,
  versionChanged: boolean,
  capture: CaptureProcessRunner = captureProcess,
): Promise<void> {
  const status = await readGit(
    config,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    capture,
  );
  const expected = versionChanged ? "M package.json" : "";
  if (status !== expected) {
    throw new AhkBuildError(
      "UNEXPECTED_RELEASE_CHANGES",
      versionChanged
        ? "Release preparation may change only package.json."
        : "Release preparation changed tracked or untracked project files.",
    );
  }
}

export async function commitTagAndPush(
  config: ResolvedConfig,
  plan: GitReleasePlan,
  logger: Logger,
  run: ProcessRunner = runProcess,
  capture: CaptureProcessRunner = captureProcess,
): Promise<void> {
  if (!config.release) {
    throw new AhkBuildError("RELEASE_DISABLED", "GitHub release publishing is not configured.");
  }

  if (plan.versionChanged) {
    await run("git", ["add", "--", "package.json"], { cwd: config.root });
    await run("git", ["commit", "-m", plan.commitMessage], { cwd: config.root });
  }

  const head = await readGit(config, ["rev-parse", "HEAD"], capture);
  const localTag = await readGitMaybe(
    config,
    ["rev-parse", "-q", "--verify", `refs/tags/${plan.tag}^{}`],
    capture,
  );
  if (localTag && localTag !== head) {
    throw new AhkBuildError(
      "RELEASE_TAG_MISMATCH",
      `Local tag ${plan.tag} points to another commit.`,
    );
  }
  if (!localTag) {
    await run(
      "git",
      ["tag", config.release.signTag === false ? "-a" : "-s", plan.tag, "-m", plan.tagMessage],
      { cwd: config.root },
    );
  }
  if (config.release.signTag !== false) {
    await run("git", ["tag", "-v", plan.tag], { cwd: config.root });
  }

  const remoteHead = firstGitField(
    await readGitMaybe(
      config,
      ["ls-remote", "--exit-code", plan.remote, plan.remoteRef],
      capture,
      2,
    ),
  );
  const remoteTag = await readRemoteTag(config, plan.remote, plan.tag, capture);
  if (remoteTag && remoteTag !== head) {
    throw new AhkBuildError(
      "RELEASE_TAG_MISMATCH",
      `Remote tag ${plan.tag} points to another commit.`,
    );
  }

  if (remoteHead !== head || remoteTag !== head) {
    logger.info(`Pushing ${plan.branch} and ${plan.tag} to ${plan.remote}...`);
    await run(
      "git",
      [
        "push",
        "--atomic",
        plan.remote,
        `HEAD:${plan.remoteRef}`,
        `refs/tags/${plan.tag}:refs/tags/${plan.tag}`,
      ],
      { cwd: config.root },
    );
  }

  const publishedHead = firstGitField(
    await readGitMaybe(
      config,
      ["ls-remote", "--exit-code", plan.remote, plan.remoteRef],
      capture,
      2,
    ),
  );
  const publishedTag = await readRemoteTag(config, plan.remote, plan.tag, capture);
  if (publishedHead !== head || publishedTag !== head) {
    throw new AhkBuildError(
      "RELEASE_PUSH_MISMATCH",
      `Remote branch and tag ${plan.tag} do not point to the release commit.`,
    );
  }
  logger.success(`Published Git tag ${plan.tag}`);
}

async function readGit(
  config: ResolvedConfig,
  args: string[],
  capture: CaptureProcessRunner,
): Promise<string> {
  const result = await capture("git", args, { cwd: config.root });
  if (result.exitCode !== 0) {
    throw new AhkBuildError(
      "GIT_COMMAND_FAILED",
      result.stderr.trim() || `git ${args[0] ?? "command"} failed.`,
    );
  }
  return result.stdout.trim();
}

async function readGitMaybe(
  config: ResolvedConfig,
  args: string[],
  capture: CaptureProcessRunner,
  missingExitCode = 1,
): Promise<string | undefined> {
  const result = await capture("git", args, { cwd: config.root });
  if (result.exitCode === missingExitCode) return undefined;
  if (result.exitCode !== 0) {
    throw new AhkBuildError(
      "GIT_COMMAND_FAILED",
      result.stderr.trim() || `git ${args[0] ?? "command"} failed.`,
    );
  }
  return result.stdout.trim() || undefined;
}

function firstGitField(output: string | undefined): string | undefined {
  return output?.split(/\s/, 1)[0];
}

async function readRemoteTag(
  config: ResolvedConfig,
  remote: string,
  tag: string,
  capture: CaptureProcessRunner,
): Promise<string | undefined> {
  const result = await capture(
    "git",
    ["ls-remote", "--tags", remote, `refs/tags/${tag}`, `refs/tags/${tag}^{}`],
    { cwd: config.root },
  );
  if (result.exitCode !== 0) {
    throw new AhkBuildError(
      "GIT_COMMAND_FAILED",
      result.stderr.trim() || `Cannot inspect remote tag ${tag}.`,
    );
  }
  const lines = result.stdout.trim().split("\n").filter(Boolean);
  const peeled = lines.find((line) => line.endsWith(`refs/tags/${tag}^{}`));
  return (peeled ?? lines[0])?.trim().split(/\s/, 1)[0];
}
