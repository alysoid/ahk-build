import fs from "node:fs/promises";
import path from "node:path";
import { describe, it } from "vitest";

import { compileProject } from "../../src/compile/compile.js";
import { loadConfig } from "../../src/config/load-config.js";
import { createLogger } from "../../src/core/logger.js";

import { copyFixture } from "../helpers.js";

const windowsIt =
  process.platform === "win32" && process.env.AHK_BUILD_INTEGRATION === "1" ? it : it.skip;

describe("managed Windows toolchain", () => {
  windowsIt(
    "downloads the managed toolchain and compiles the minimal fixture",
    async () => {
      const root = await copyFixture("minimal");
      const config = await loadConfig({ cwd: root });
      const isolatedConfig = {
        ...config,
        directories: {
          ...config.directories,
          cache: path.join(root, "cache"),
        },
      };

      const output = await compileProject(isolatedConfig, createLogger(false));
      const stat = await fs.stat(output);

      if (!stat.isFile() || stat.size === 0) {
        throw new Error(`Compiled executable is empty or missing: ${output}`);
      }
      await fs.stat(path.join(path.dirname(output), "readme.txt"));
      await fs.stat(path.join(path.dirname(output), "runtime", "readme.txt"));
    },
    180_000,
  );
});
