import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const script = path.resolve("scripts", "verify-release-tag.mjs");

describe("verify-release-tag", () => {
  it("accepts the package version tag", async () => {
    await expect(execFileAsync(process.execPath, [script, "v0.1.0"])).resolves.toBeDefined();
  });

  it("rejects a tag that does not match package.json.version", async () => {
    await expect(execFileAsync(process.execPath, [script, "v0.1.1"])).rejects.toMatchObject({
      code: 1,
    });
  });
});
