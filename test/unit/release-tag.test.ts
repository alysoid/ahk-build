import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts", "verify-release-tag.mjs");
const packageJsonPath = path.join(root, "package.json");

describe("verify-release-tag", () => {
  it("accepts the package version tag", async () => {
    const version = await readPackageVersion();
    await expect(execFileAsync(process.execPath, [script, `v${version}`])).resolves.toBeDefined();
  });

  it("rejects a tag that does not match package.json.version", async () => {
    const mismatchedTag = `v0${await readPackageVersion()}`;
    await expect(execFileAsync(process.execPath, [script, mismatchedTag])).rejects.toMatchObject({
      code: 1,
    });
  });

  it("accepts an explicit prerelease package version", async () => {
    const sandbox = await mkdtemp(path.join(os.tmpdir(), "ahk-build-release-tag-"));
    const sandboxScript = path.join(sandbox, "scripts", "verify-release-tag.mjs");
    try {
      await mkdir(path.dirname(sandboxScript), { recursive: true });
      await writeFile(sandboxScript, await readFile(script, "utf8"));
      await writeFile(
        path.join(sandbox, "package.json"),
        JSON.stringify({ name: "fixture", version: "0.1.0-rc.0" }),
      );
      await expect(
        execFileAsync(process.execPath, [sandboxScript, "v0.1.0-rc.0"]),
      ).resolves.toBeDefined();
    } finally {
      await rm(sandbox, { force: true, recursive: true });
    }
  });
});

async function readPackageVersion() {
  const packageJson: unknown = JSON.parse(await readFile(packageJsonPath, "utf8"));
  if (
    typeof packageJson !== "object" ||
    packageJson === null ||
    !("version" in packageJson) ||
    typeof packageJson.version !== "string"
  ) {
    throw new Error("package.json must contain a string version");
  }
  return packageJson.version;
}
