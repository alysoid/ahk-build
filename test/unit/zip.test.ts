import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/load-config.js";
import { createLogger } from "../../src/core/logger.js";
import { createPortableZip } from "../../src/package/zip.js";

import { copyFixture } from "../helpers.js";

describe("createPortableZip", () => {
  it("creates a deterministic archive with explicit destinations", async () => {
    const root = await copyFixture("minimal");
    await fs.mkdir(path.join(root, "build"), { recursive: true });
    await fs.writeFile(path.join(root, "build", "Fixture.exe"), "fake executable");
    const config = await loadConfig({ cwd: root });
    const logger = createLogger(false);

    const firstPath = await createPortableZip(config, logger);
    const first = await fs.readFile(firstPath);
    await fs.rm(firstPath);
    const secondPath = await createPortableZip(config, logger);
    const second = await fs.readFile(secondPath);

    expect(hash(first)).toBe(hash(second));
    const entries = Object.keys(unzipSync(first)).sort();
    expect(entries).toEqual(["Fixture.exe", "LICENSE", "assets/readme.txt"]);
  });
});

function hash(value: Uint8Array): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
