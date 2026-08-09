import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { cleanCommand } from "../../src/commands/clean.js";
import { loadConfig } from "../../src/config/load-config.js";
import type { Logger } from "../../src/core/logger.js";

import { copyFixture } from "../helpers.js";

const logger: Logger = {
  debug: () => undefined,
  error: () => undefined,
  info: () => undefined,
  success: () => undefined,
  warn: () => undefined,
};

describe("clean command", () => {
  it("removes generated project directories", async () => {
    const root = await copyFixture("minimal");
    const config = await loadConfig({ cwd: root });
    await fs.mkdir(config.directories.build);

    await cleanCommand(config, logger);

    await expect(fs.access(config.directories.build)).rejects.toThrow();
  });

  it("refuses the project root and its parent", async () => {
    const root = await copyFixture("minimal");
    const config = await loadConfig({ cwd: root });

    for (const build of [root, path.dirname(root)]) {
      await expect(
        cleanCommand({ ...config, directories: { ...config.directories, build } }, logger),
      ).rejects.toMatchObject({ code: "UNSAFE_CLEAN_TARGET" });
    }

    await expect(fs.readFile(path.join(root, "package.json"), "utf8")).resolves.toContain(
      "fixture-minimal",
    );
  });

  it("refuses the home directory and filesystem root", async () => {
    const root = await copyFixture("minimal");
    const config = await loadConfig({ cwd: root });

    for (const build of [os.homedir(), path.parse(root).root]) {
      await expect(
        cleanCommand({ ...config, directories: { ...config.directories, build } }, logger),
      ).rejects.toMatchObject({ code: "UNSAFE_CLEAN_TARGET" });
    }
  });

  it("allows an explicit external cache directory", async () => {
    const root = await copyFixture("minimal");
    const config = await loadConfig({ cwd: root });
    const cache = await fs.mkdtemp(path.join(os.tmpdir(), "ahk-build-cache-"));

    await cleanCommand({ ...config, directories: { ...config.directories, cache } }, logger, true);

    await expect(fs.access(cache)).rejects.toThrow();
  });
});
