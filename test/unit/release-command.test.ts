import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { releaseCommand } from "../../src/commands/release.js";
import { loadConfig } from "../../src/config/load-config.js";
import { createLogger } from "../../src/core/logger.js";
import {
  captureProcess,
  runProcess,
  type CaptureProcessRunner,
  type ProcessRunner,
} from "../../src/core/process.js";

import { createGitRepository, runGit } from "../helpers.js";

describe("releaseCommand", () => {
  it("builds, commits, tags, pushes, verifies, and publishes", async () => {
    const root = await createGitRepository({
      remotePrefix: "ahk-build-command-remote-",
      gitignore: "fixture.zip\n",
    });
    const source = await loadConfig({ cwd: root });
    const body = Buffer.from("release asset");
    const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
    const remoteReleases = [
      failure(),
      releaseJson(true, digest, body.length),
      releaseJson(false, digest, body.length),
    ];
    const ghCalls: string[][] = [];
    const run: ProcessRunner = (command, args, options) => {
      if (command === "git") return runProcess(command, args, options);
      ghCalls.push([command, ...args]);
      return Promise.resolve();
    };
    const capture: CaptureProcessRunner = (command, args, options) =>
      command === "git"
        ? captureProcess(command, args, options)
        : Promise.resolve(remoteReleases.shift() ?? failure());

    await releaseCommand(
      {
        ...source,
        release: {
          repository: "alysoid/fixture",
          assets: ["fixture.zip"],
          signTag: false,
        },
      },
      createLogger(false),
      { version: "1.2.4", yes: true },
      {
        run,
        capture,
        build: async () => fs.writeFile(path.join(root, "fixture.zip"), body),
        confirm: () => Promise.reject(new Error("confirmation should be skipped")),
      },
    );

    expect(ghCalls.map((call) => call.slice(0, 3))).toEqual([
      ["gh", "auth", "status"],
      ["gh", "auth", "status"],
      ["gh", "release", "create"],
      ["gh", "release", "edit"],
    ]);
    expect(await runGit(root, ["log", "-1", "--format=%s"])).toBe("chore(release): prepare 1.2.4");
    expect(await runGit(root, ["tag", "--list", "v1.2.4"])).toBe("v1.2.4");
  }, 15_000);
});

function failure() {
  return { exitCode: 1, signal: null, stdout: "", stderr: "not found" } as const;
}

function releaseJson(isDraft: boolean, digest: string, size: number) {
  return {
    exitCode: 0,
    signal: null,
    stderr: "",
    stdout: JSON.stringify({
      tagName: "v1.2.4",
      isDraft,
      isPrerelease: false,
      assets: [{ name: "fixture.zip", size, digest }],
    }),
  } as const;
}
