import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { captureProcess } from "../src/core/process.js";

export async function copyFixture(name: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ahk-build-test-"));
  const source = path.resolve("test", "fixtures", name);
  await fs.cp(source, root, { recursive: true });
  return root;
}

export async function createGitRepository(
  options: {
    remotePrefix?: string;
    gitignore?: string;
  } = {},
): Promise<string> {
  const root = await copyFixture("minimal");
  const remote = await fs.mkdtemp(
    path.join(os.tmpdir(), options.remotePrefix ?? "ahk-build-remote-"),
  );
  if (options.gitignore) await fs.writeFile(path.join(root, ".gitignore"), options.gitignore);
  await runGit(root, ["init", "-b", "main"]);
  await runGit(root, ["config", "user.name", "Fixture User"]);
  await runGit(root, ["config", "user.email", "fixture@example.test"]);
  await runGit(root, ["add", "."]);
  await runGit(root, ["commit", "-m", "Initial fixture"]);
  await runGit(root, ["init", "--bare", remote]);
  await runGit(root, ["remote", "add", "origin", remote]);
  await runGit(root, ["push", "-u", "origin", "main"]);
  return root;
}

export async function runGit(cwd: string, args: string[]): Promise<string> {
  const result = await captureProcess("git", args, { cwd });
  if (result.exitCode !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
