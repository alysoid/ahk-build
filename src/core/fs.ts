import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AhkBuildError } from "./errors.js";

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function ensureFile(target: string, label = "file"): Promise<void> {
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw new Error("not a file");
  } catch (error) {
    throw new AhkBuildError("MISSING_FILE", `Missing ${label}: ${target}`, { cause: error });
  }
}

export async function ensureDirectory(target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
}

export function resolveFrom(root: string, target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(root, target);
}

export function normalizeArchivePath(target: string): string {
  const normalized = target.replaceAll("\\", "/").replace(/^\.\//, "");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new AhkBuildError("UNSAFE_ARCHIVE_PATH", `Unsafe archive path: ${target}`);
  }
  return normalized;
}

export function assertSafeDeletionTarget(target: string, projectRoot: string): void {
  const resolvedTarget = path.resolve(target);
  const resolvedProjectRoot = path.resolve(projectRoot);
  const homeDirectory = path.resolve(os.homedir());

  if (
    resolvedTarget === path.parse(resolvedTarget).root ||
    resolvedTarget === homeDirectory ||
    isSameOrAncestor(resolvedTarget, resolvedProjectRoot)
  ) {
    throw new AhkBuildError("UNSAFE_CLEAN_TARGET", `Unsafe clean target: ${target}`);
  }
}

function isSameOrAncestor(target: string, descendant: string): boolean {
  const relative = path.relative(target, descendant);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}
