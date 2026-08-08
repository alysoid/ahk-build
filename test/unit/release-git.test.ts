import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/load-config.js";
import { createLogger } from "../../src/core/logger.js";
import {
  applyReleaseVersion,
  assertReleaseWorktree,
  commitTagAndPush,
  inspectGitRelease,
  writePackageVersion,
} from "../../src/release/git.js";

import { copyFixture, createGitRepository, runGit } from "../helpers.js";

describe("Git release workflow", () => {
  it("updates package.json, commits, tags, and atomically pushes", async () => {
    const root = await createGitRepository();
    const source = await loadConfig({ cwd: root });
    const prepared = applyReleaseVersion(
      {
        ...source,
        release: {
          repository: "alysoid/fixture",
          assets: ["fixture.zip"],
          signTag: false,
        },
      },
      "1.2.4",
    );
    const plan = await inspectGitRelease(prepared.config, prepared.versionChanged);

    await writePackageVersion(prepared.config);
    await assertReleaseWorktree(prepared.config, true);
    await commitTagAndPush(prepared.config, plan, createLogger(false));

    expect(JSON.parse(await fs.readFile(prepared.config.packagePath, "utf8"))).toMatchObject({
      version: "1.2.4",
    });
    expect(await runGit(root, ["log", "-1", "--format=%s"])).toBe("chore(release): prepare 1.2.4");
    const head = await runGit(root, ["rev-parse", "HEAD"]);
    expect(await runGit(root, ["ls-remote", "origin", "refs/heads/main"])).toContain(head);
    expect(await runGit(root, ["ls-remote", "origin", "refs/tags/v1.2.4^{}"])).toContain(head);
  });

  it("refuses to prepare a release from a dirty worktree", async () => {
    const root = await createGitRepository();
    await fs.writeFile(path.join(root, "untracked.txt"), "dirty");
    const source = await loadConfig({ cwd: root });
    const prepared = applyReleaseVersion({
      ...source,
      release: { repository: "alysoid/fixture", signTag: false },
    });

    await expect(inspectGitRelease(prepared.config, prepared.versionChanged)).rejects.toMatchObject(
      { code: "DIRTY_WORKTREE" },
    );
  });

  it("resumes an explicit version prepared by an interrupted release", async () => {
    const root = await createGitRepository();
    const source = await loadConfig({ cwd: root });
    const prepared = applyReleaseVersion(
      {
        ...source,
        release: { repository: "alysoid/fixture", signTag: false },
      },
      "1.2.4",
    );
    await writePackageVersion(prepared.config);

    const resumed = await inspectGitRelease(prepared.config, false, true);

    expect(resumed.versionChanged).toBe(true);
    expect(resumed.tag).toBe("v1.2.4");
  });

  it("reports a missing upstream before release work starts", async () => {
    const root = await copyFixture("minimal");
    await runGit(root, ["init", "-b", "main"]);
    await runGit(root, ["config", "user.name", "Fixture User"]);
    await runGit(root, ["config", "user.email", "fixture@example.test"]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "Initial fixture"]);
    const source = await loadConfig({ cwd: root });
    const prepared = applyReleaseVersion({
      ...source,
      release: { repository: "alysoid/fixture", signTag: false },
    });

    await expect(inspectGitRelease(prepared.config, prepared.versionChanged)).rejects.toMatchObject(
      { code: "RELEASE_UPSTREAM_MISSING" },
    );
  });
});
