import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/load-config.js";
import { createLogger } from "../../src/core/logger.js";
import type { CaptureProcessRunner, ProcessRunner } from "../../src/core/process.js";
import { createGitHubRelease } from "../../src/release/github.js";

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
      createGitHubRelease(releaseConfig, createLogger(false), record(calls), capture([])),
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
      createGitHubRelease(releaseConfig, createLogger(false), record(calls), capture([])),
    ).rejects.toMatchObject({ code: "DUPLICATE_RELEASE_ASSET" });
    expect(calls).toEqual([]);
  });

  it("creates a verified draft before publishing it", async () => {
    const root = await copyFixture("minimal");
    const asset = path.join(root, "fixture.zip");
    const body = Buffer.from("fixture");
    await fs.writeFile(asset, body);
    const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
    const calls: string[][] = [];
    const releases = [
      failure(),
      releaseJson(true, digest, body.byteLength),
      releaseJson(false, digest, body.byteLength),
    ];
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
      record(calls),
      capture(releases),
    );

    expect(calls).toEqual([
      ["gh", "auth", "status"],
      [
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
        "--draft",
      ],
      ["gh", "release", "edit", "v1.2.3", "--repo", "alysoid/ahk-build-test", "--draft=false"],
    ]);
  });

  it("generates simple notes from commits when enabled", async () => {
    const root = await copyFixture("minimal");
    const body = Buffer.from("fixture");
    await fs.writeFile(path.join(root, "fixture.zip"), body);
    const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
    const calls: string[][] = [];
    const captureResults = [
      failure(),
      { exitCode: 0, signal: null, stdout: "v1.2.2\n", stderr: "" },
      {
        exitCode: 0,
        signal: null,
        stdout: "fix: correct release notes\nfeat: add generated notes\n",
        stderr: "",
      },
      releaseJson(true, digest, body.byteLength),
      releaseJson(false, digest, body.byteLength),
    ];
    const config = await loadConfig({ cwd: root });

    await createGitHubRelease(
      {
        ...config,
        release: {
          repository: "alysoid/ahk-build-test",
          assets: ["fixture.zip"],
          generateNotes: true,
        },
      },
      createLogger(false),
      record(calls),
      capture(captureResults),
    );

    expect(calls.find((call) => call[1] === "release" && call[2] === "create")).toContain(
      "## Changes\n\n- fix: correct release notes\n- feat: add generated notes",
    );
  });

  it("accepts an already published release only when assets match", async () => {
    const root = await copyFixture("minimal");
    const body = Buffer.from("fixture");
    await fs.writeFile(path.join(root, "fixture.zip"), body);
    const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
    const config = await loadConfig({ cwd: root });
    const calls: string[][] = [];
    const releaseConfig = {
      ...config,
      release: { repository: "alysoid/ahk-build-test", assets: ["fixture.zip"] },
    };

    await createGitHubRelease(
      releaseConfig,
      createLogger(false),
      record(calls),
      capture([releaseJson(false, digest, body.byteLength)]),
    );
    expect(calls).toEqual([["gh", "auth", "status"]]);

    await expect(
      createGitHubRelease(
        releaseConfig,
        createLogger(false),
        record([]),
        capture([releaseJson(false, "sha256:wrong", body.byteLength)]),
      ),
    ).rejects.toMatchObject({ code: "RELEASE_ASSET_MISMATCH" });
  });
});

function record(calls: string[][]): ProcessRunner {
  return (command, args) => {
    calls.push([command, ...args]);
    return Promise.resolve();
  };
}

function capture(results: Awaited<ReturnType<CaptureProcessRunner>>[]): CaptureProcessRunner {
  let index = 0;
  return () => Promise.resolve(results[index++] ?? failure());
}

function failure(): Awaited<ReturnType<CaptureProcessRunner>> {
  return { exitCode: 1, signal: null, stdout: "", stderr: "not found" };
}

function releaseJson(
  isDraft: boolean,
  digest: string,
  size: number,
): Awaited<ReturnType<CaptureProcessRunner>> {
  return {
    exitCode: 0,
    signal: null,
    stderr: "",
    stdout: JSON.stringify({
      tagName: "v1.2.3",
      isDraft,
      isPrerelease: false,
      assets: [{ name: "fixture.zip", size, digest }],
    }),
  };
}
