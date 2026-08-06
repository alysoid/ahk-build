import fs from "node:fs/promises";
import path from "node:path";

import { AhkBuildError } from "../core/errors.js";
import { pathExists, resolveFrom } from "../core/fs.js";

export interface ProjectCopySpec {
  from: string;
  to?: string;
}

export interface ProjectCopyErrors {
  missing: string;
  unsafe: string;
  label: string;
}

export async function copyProjectFiles(
  root: string,
  destinationRoot: string,
  items: (string | ProjectCopySpec)[],
  errors: ProjectCopyErrors,
): Promise<void> {
  for (const item of items) {
    const spec = typeof item === "string" ? { from: item } : item;
    const source = resolveFrom(root, spec.from);
    if (!(await pathExists(source))) {
      throw new AhkBuildError(errors.missing, `Missing ${errors.label}: ${source}`);
    }

    const destination = path.resolve(destinationRoot, spec.to ?? path.basename(source));
    const relative = path.relative(destinationRoot, destination);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AhkBuildError(
        errors.unsafe,
        `${errors.label} destination escapes output: ${spec.to ?? path.basename(source)}`,
      );
    }

    await fs.cp(source, destination, { force: true, recursive: true });
  }
}
