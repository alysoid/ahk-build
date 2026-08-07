import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tarballArgument = process.argv[2];
if (!tarballArgument) throw new Error("Usage: node scripts/tarball-smoke.mjs <tarball>");
const tarball = path.resolve(tarballArgument);

const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const consumer = await fs.mkdtemp(path.join(os.tmpdir(), "ahk-build-tarball-consumer-"));
const consumerRelativePath = path.relative(root, consumer);
if (
  !path.isAbsolute(consumerRelativePath) &&
  consumerRelativePath !== ".." &&
  !consumerRelativePath.startsWith(`..${path.sep}`)
) {
  throw new Error("Tarball smoke consumer must be outside the package repository.");
}

try {
  await fs.cp(path.join(root, "test", "fixtures", "minimal"), consumer, { recursive: true });
  const consumerPackagePath = path.join(consumer, "package.json");
  const consumerPackage = JSON.parse(await fs.readFile(consumerPackagePath, "utf8"));
  consumerPackage.packageManager = packageJson.packageManager;
  await fs.writeFile(consumerPackagePath, `${JSON.stringify(consumerPackage, null, 2)}\n`);
  await runPnpm(["add", "--save-dev", tarball, "typescript@6.0.3"]);
  await runNode([
    "--input-type=module",
    "-e",
    'import { defineConfig } from "@alysoid/ahk-build"; if (typeof defineConfig !== "function") throw new Error("defineConfig export missing");',
  ]);
  await fs.writeFile(
    path.join(consumer, "typecheck.mts"),
    'import { defineConfig, type CompileAsset } from "@alysoid/ahk-build";\nconst asset: CompileAsset = { from: "assets/readme.txt", to: "readme.txt" };\ndefineConfig({ entry: "Fixture.ahk", app: { name: "Fixture", executable: "Fixture.exe" }, compile: { assets: [asset] } });\n',
  );
  await runPnpm([
    "exec",
    "tsc",
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--target",
    "ES2024",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "typecheck.mts",
  ]);
  await runPnpm(["exec", "ahk-build", "--version"], { expectedOutput: packageJson.version });
  await runPnpm(["exec", "ahk-build", "doctor"]);

  if (process.platform === "win32" && process.env.AHK_BUILD_TARBALL_SMOKE_WINDOWS === "1") {
    await runPnpm(["exec", "ahk-build", "setup"]);
    await runPnpm(["exec", "ahk-build", "compile"]);
    await runPnpm(["exec", "ahk-build", "zip"]);
    await ensureFile(path.join(consumer, "build", "Fixture.exe"));
    await ensureFile(path.join(consumer, "dist", "Fixture-1.2.3.zip"));
  }

  await ensureFile(path.join(consumer, "node_modules", "@alysoid", "ahk-build", "dist", "cli.js"));
  await ensureFile(
    path.join(consumer, "node_modules", "@alysoid", "ahk-build", "dist", "index.d.ts"),
  );
  console.log(`Tarball smoke passed in ${consumer}`);
} finally {
  if (process.env.AHK_BUILD_KEEP_SMOKE !== "1") {
    await fs.rm(consumer, { force: true, recursive: true });
  } else {
    console.log(`Kept tarball smoke consumer at ${consumer}`);
  }
}

async function runNode(args, options = {}) {
  await run(process.execPath, args, options);
}

async function runPnpm(args, options = {}) {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error("Cannot run pnpm: npm_execpath is not available.");
  }
  await run(process.execPath, [npmExecPath, ...args], options);
}

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: consumer,
      stdio: ["inherit", "pipe", "inherit"],
      shell: false,
      windowsHide: true,
    });
    let output = "";
    child.stdout?.on("data", (value) => {
      output += value.toString();
      process.stdout.write(value);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
        return;
      }
      if (options.expectedOutput && !output.includes(options.expectedOutput)) {
        reject(new Error(`Expected ${options.expectedOutput} in ${command} output.`));
        return;
      }
      resolve();
    });
  });
}

async function ensureFile(target) {
  const stat = await fs.stat(target);
  if (!stat.isFile()) throw new Error(`Expected file: ${target}`);
}
