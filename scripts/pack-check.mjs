import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(root, "package.json");
const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
const artifactsDirectory = path.join(root, ".artifacts");
const expectedTarball = path.join(
  artifactsDirectory,
  `${packageJson.name.replace(/^@/, "").replaceAll("/", "-")}-${packageJson.version}.tgz`,
);
const checksumPath = `${expectedTarball}.sha256`;

await ensureBuildOutput();
await fs.rm(artifactsDirectory, { force: true, recursive: true });
await fs.mkdir(artifactsDirectory, { recursive: true });
await runPackageCommand();

const archive = await fs.readFile(expectedTarball);
const entries = readTarGz(archive);
const manifest = JSON.parse(entries.get("package/package.json") ?? "null");
validateManifest(manifest, packageJson);
validateEntries(entries);
const digest = crypto.createHash("sha256").update(archive).digest("hex");
await fs.writeFile(checksumPath, `${digest}  ${path.basename(expectedTarball)}\n`);

console.log(`Validated ${expectedTarball}`);
if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    `tarball=${expectedTarball}\nchecksum=${checksumPath}\n`,
  );
}

async function ensureBuildOutput() {
  for (const required of ["dist/cli.js", "dist/index.js", "dist/index.d.ts"]) {
    try {
      const stat = await fs.stat(path.join(root, required));
      if (!stat.isFile()) throw new Error("not a file");
    } catch (error) {
      throw new Error(`Missing build output ${required}; run pnpm build first.`, { cause: error });
    }
  }
}

async function runPackageCommand() {
  const command = "pnpm";
  await new Promise((resolve, reject) => {
    const child = spawn(command, ["pack", "--pack-destination", artifactsDirectory], {
      cwd: root,
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pnpm pack exited with code ${code ?? "unknown"}`));
    });
  });
}

function validateManifest(actual, expected) {
  if (!actual || actual.name !== expected.name || actual.version !== expected.version) {
    throw new Error("Packed package manifest does not match package.json name/version.");
  }
  if (actual.bin?.["ahk-build"] !== "./dist/cli.js") {
    throw new Error("Packed package does not expose the ahk-build binary.");
  }
  if (actual.exports?.["."]?.import !== "./dist/index.js") {
    throw new Error("Packed package does not expose the ESM entry point.");
  }
  if (actual.exports?.["."]?.types !== "./dist/index.d.ts") {
    throw new Error("Packed package does not expose TypeScript declarations.");
  }
}

function validateEntries(entries) {
  const required = [
    "package/LICENSE",
    "package/README.md",
    "package/package.json",
    "package/dist/cli.js",
    "package/dist/index.js",
    "package/dist/index.d.ts",
  ];
  for (const entry of required) {
    if (!entries.has(entry)) throw new Error(`Packed package is missing ${entry}.`);
  }

  for (const entry of entries.keys()) {
    if (
      !entry.startsWith("package/dist/") &&
      !["package/LICENSE", "package/README.md", "package/package.json"].includes(entry)
    ) {
      throw new Error(`Unexpected file in packed package: ${entry}`);
    }
  }
}

function readTarGz(value) {
  const tar = gunzipSync(value);
  const entries = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    const name = readString(header.subarray(0, 100));
    if (!name) break;
    const size = Number.parseInt(readString(header.subarray(124, 136)) || "0", 8);
    const dataStart = offset + 512;
    entries.set(name, tar.subarray(dataStart, dataStart + size).toString("utf8"));
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function readString(value) {
  return value.toString("utf8").replace(/\0.*$/, "").trim();
}
