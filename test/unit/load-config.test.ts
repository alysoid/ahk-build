import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/load-config.js";

import { copyFixture } from "../helpers.js";

describe("loadConfig", () => {
  it("loads and resolves a project configuration", async () => {
    const root = await copyFixture("minimal");
    const config = await loadConfig({ cwd: root });

    expect(config.packageMetadata.version).toBe("1.2.3");
    expect(config.compile.architecture).toBe("x64");
    expect(config.compile.compression).toBe("none");
    expect(config.directories.build).toBe(path.join(root, "build"));
    expect(config.toolchain.provider).toBe("managed");
  });
});
