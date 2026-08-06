import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { copyProjectFiles } from "../../src/compile/copy-files.js";
import { loadConfig } from "../../src/config/load-config.js";

import { copyFixture } from "../helpers.js";

const errors = {
  missing: "MISSING_COMPILE_ASSET",
  unsafe: "UNSAFE_COMPILE_ASSET_PATH",
  label: "compile asset",
};

describe("compile assets", () => {
  it("copies files and directories beside the executable", async () => {
    const root = await copyFixture("minimal");
    const config = await loadConfig({ cwd: root });
    const output = path.join(root, "build", "Fixture.exe");
    const assetConfig = {
      ...config,
      compile: {
        ...config.compile,
        assets: ["assets/readme.txt", { from: "assets", to: "runtime" }],
      },
    };

    await copyProjectFiles(
      assetConfig.root,
      path.dirname(output),
      assetConfig.compile.assets,
      errors,
    );

    await expect(fs.readFile(path.join(root, "build", "readme.txt"), "utf8")).resolves.toBe(
      "fixture asset\n",
    );
    await expect(
      fs.readFile(path.join(root, "build", "runtime", "readme.txt"), "utf8"),
    ).resolves.toBe("fixture asset\n");
  });

  it("rejects missing and escaping assets", async () => {
    const root = await copyFixture("minimal");
    const config = await loadConfig({ cwd: root });
    const output = path.join(root, "build", "Fixture.exe");

    await expect(
      copyProjectFiles(config.root, path.dirname(output), ["missing.dll"], errors),
    ).rejects.toMatchObject({ code: "MISSING_COMPILE_ASSET" });
    await expect(
      copyProjectFiles(
        config.root,
        path.dirname(output),
        [{ from: "assets", to: "../outside" }],
        errors,
      ),
    ).rejects.toMatchObject({ code: "UNSAFE_COMPILE_ASSET_PATH" });
  });
});
