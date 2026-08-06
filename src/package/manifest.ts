import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "tinyglobby";

import type { ArchiveEntry, ResolvedConfig } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import { normalizeArchivePath, pathExists, resolveFrom } from "../core/fs.js";
import { createTemplateContext } from "../core/project.js";
import { interpolate } from "../core/template.js";

export interface ResolvedArchiveEntry {
  source: string;
  destination: string;
}

export async function resolveArchiveManifest(
  config: ResolvedConfig,
): Promise<ResolvedArchiveEntry[]> {
  if (!config.portable) {
    throw new AhkBuildError("PORTABLE_DISABLED", "Portable ZIP packaging is not configured.");
  }

  const context = createTemplateContext(config);
  const entries: ResolvedArchiveEntry[] = [];

  for (const item of config.portable.files) {
    const spec: ArchiveEntry = typeof item === "string" ? { from: item } : item;
    const from = interpolate(spec.from, context);
    const to = spec.to ? interpolate(spec.to, context) : undefined;
    entries.push(...(await expandEntry(config.root, from, to, config.portable.exclude ?? [])));
  }

  const unique = new Map<string, ResolvedArchiveEntry>();
  for (const entry of entries) {
    if (unique.has(entry.destination)) {
      throw new AhkBuildError(
        "DUPLICATE_ARCHIVE_PATH",
        `Multiple files map to archive path ${entry.destination}`,
      );
    }
    unique.set(entry.destination, entry);
  }

  return [...unique.values()].sort((a, b) => a.destination.localeCompare(b.destination));
}

async function expandEntry(
  root: string,
  from: string,
  to: string | undefined,
  exclude: string[],
): Promise<ResolvedArchiveEntry[]> {
  const absolute = resolveFrom(root, from);

  if (await pathExists(absolute)) {
    const stat = await fs.stat(absolute);
    if (stat.isFile()) {
      return [
        {
          source: absolute,
          destination: normalizeArchivePath(to ?? path.basename(absolute)),
        },
      ];
    }

    if (stat.isDirectory()) {
      const matches = await glob("**/*", {
        cwd: absolute,
        onlyFiles: true,
        dot: true,
        ignore: exclude,
      });
      const base = to ?? path.basename(absolute);
      return matches.map((match) => ({
        source: path.join(absolute, match),
        destination: normalizeArchivePath(path.posix.join(toPosix(base), toPosix(match))),
      }));
    }
  }

  if (!hasGlob(from)) {
    throw new AhkBuildError("ARCHIVE_INPUT_NOT_FOUND", `File or directory not found: ${from}`);
  }

  const matches = await glob(toPosix(from), {
    cwd: root,
    absolute: true,
    onlyFiles: true,
    dot: true,
    ignore: exclude,
  });
  if (matches.length === 0) {
    throw new AhkBuildError("ARCHIVE_INPUT_NOT_FOUND", `No files matched: ${from}`);
  }

  return matches.map((match) => {
    const relative = toPosix(path.relative(root, match));
    return {
      source: match,
      destination: normalizeArchivePath(to ? path.posix.join(toPosix(to), relative) : relative),
    };
  });
}

function hasGlob(value: string): boolean {
  return /[*?[\]{}()!]/.test(value);
}

function toPosix(value: string): string {
  return value.replaceAll("\\", "/");
}
