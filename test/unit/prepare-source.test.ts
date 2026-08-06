import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { prepareSource } from "../../src/compile/prepare-source.js";
import { loadConfig } from "../../src/config/load-config.js";
import { createLogger } from "../../src/core/logger.js";

import { copyFixture } from "../helpers.js";

describe("prepareSource", () => {
  it("injects metadata, replaces version tokens, and removes old directives", async () => {
    const root = await copyFixture("minimal");
    const config = await loadConfig({ cwd: root });
    const generatedPath = await prepareSource(config, createLogger(false));
    const generated = await fs.readFile(generatedPath, "utf8");

    expect(generated).toContain(";@Ahk2Exe-SetVersion 1.2.3");
    expect(generated).toContain(";@Ahk2Exe-SetCopyright Copyright (c) 2026`, Fixture Author");
    expect(generated).toContain('APP_VERSION := "1.2.3"');
    expect(generated).not.toContain(";@Ahk2Exe-SetVersion 0.0.0");
    await expect(
      fs.readFile(`${root}/.ahk-build/generated/includes/Helper.ahk`, "utf8"),
    ).resolves.toContain("FixtureHelper");
  });

  it("preserves consumer-owned directives without injecting package metadata", async () => {
    const root = await copyFixture("minimal");
    const config = await loadConfig({ cwd: root });
    const generatedPath = await prepareSource(
      { ...config, compile: { ...config.compile, directives: "preserve" } },
      createLogger(false),
    );
    const generated = await fs.readFile(generatedPath, "utf8");

    expect(generated).toContain(";@Ahk2Exe-SetVersion 0.0.0");
    expect(generated).not.toContain(";@Ahk2Exe-SetName Fixture App");
    expect(generated).toContain('APP_VERSION := "1.2.3"');
  });
});
