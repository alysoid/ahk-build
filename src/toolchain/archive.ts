import fs from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";

import { AhkBuildError } from "../core/errors.js";
import { ensureDirectory, normalizeArchivePath } from "../core/fs.js";

export async function extractZip(archivePath: string, destination: string): Promise<void> {
  const archive = new Uint8Array(await fs.readFile(archivePath));
  const entries = unzipSync(archive);

  await fs.rm(destination, { force: true, recursive: true });
  await ensureDirectory(destination);

  for (const [entryName, contents] of Object.entries(entries)) {
    const normalized = normalizeArchivePath(entryName);
    if (!normalized || normalized.endsWith("/")) continue;

    const target = path.join(destination, ...normalized.split("/"));
    const relative = path.relative(destination, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AhkBuildError("UNSAFE_ARCHIVE_PATH", `Unsafe archive entry: ${entryName}`);
    }

    await ensureDirectory(path.dirname(target));
    await fs.writeFile(target, contents);
  }
}

export async function findFileByBasename(root: string, basename: string): Promise<string | null> {
  const expected = basename.toLowerCase();
  const entries = await fs.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFileByBasename(target, basename);
      if (nested) return nested;
    } else if (entry.name.toLowerCase() === expected) {
      return target;
    }
  }

  return null;
}
