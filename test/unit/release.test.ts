import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createGitHubRelease, type ReleaseProcessRunner } from "../../src/release/github.js";
import { createLogger } from "../../src/core/logger.js";
import { loadConfig } from "../../src/config/load-config.js";

import { copyFixture } from "../helpers.js";

describe("createGitHubRelease", () => {
  it("rejects missing release assets before starting GitHub CLI", async () => {
    const root = await copyFixture("minimal");
    const config = await loadConfig({ cwd: root });
    const releaseConfig = {
      ...config,
      release: {
        repository: "alysoid/ahk-build-test",
        assets: ["missing/fixture.zip"],
      },
    };
    const calls: string[][] = [];

    await expect(
      createGitHubRelease(releaseConfig, createLogger(false), (command, args) => {
        calls.push([command, ...args]);
        return Promise.resolve();
      }),
    ).rejects.toMatchObject({ code: "MISSING_FILE" });
    expect(calls).toEqual([]);
  });

  it("rejects release assets with duplicate basenames", async () => {
    const root = await copyFixture("minimal");
    await fs.mkdir(path.join(root, "first"), { recursive: true });
    await fs.mkdir(path.join(root, "second"), { recursive: true });
    await fs.writeFile(path.join(root, "first", "fixture.zip"), "first");
    await fs.writeFile(path.join(root, "second", "Fixture.ZIP"), "second");
    const config = await loadConfig({ cwd: root });
    const releaseConfig = {
      ...config,
      release: {
        repository: "alysoid/ahk-build-test",
        assets: ["first/fixture.zip", "second/Fixture.ZIP"],
      },
    };
    const calls: string[][] = [];

    await expect(
      createGitHubRelease(releaseConfig, createLogger(false), (command, args) => {
        calls.push([command, ...args]);
        return Promise.resolve();
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_RELEASE_ASSET" });
    expect(calls).toEqual([]);
  });

  it("passes a verified tag to a controlled GitHub CLI boundary", async () => {
    const root = await copyFixture("minimal");
    const asset = path.join(root, "fixture.zip");
    await fs.writeFile(asset, "fixture");
    const calls: string[][] = [];
    const run: ReleaseProcessRunner = (command, args) => {
      calls.push([command, ...args]);
      return Promise.resolve();
    };
    const config = await loadConfig({ cwd: root });
    await createGitHubRelease(
      {
        ...config,
        release: {
          repository: "alysoid/ahk-build-test",
          assets: ["fixture.zip"],
        },
      },
      createLogger(false),
      run,
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(["gh", "auth", "status"]);
    expect(calls[1]).toEqual([
      "gh",
      "release",
      "create",
      "v1.2.3",
      asset,
      "--repo",
      "alysoid/ahk-build-test",
      "--verify-tag",
      "--title",
      "Release v1.2.3",
      "--notes",
      "Release version 1.2.3",
    ]);
  });
});
