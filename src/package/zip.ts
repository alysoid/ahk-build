import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import * as yazl from "yazl";

import type { ResolvedConfig } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import { ensureDirectory } from "../core/fs.js";
import type { Logger } from "../core/logger.js";
import { getPortableOutput } from "../core/artifacts.js";
import { resolveArchiveManifest } from "./manifest.js";

const REPRODUCIBLE_MTIME = new Date("1980-01-01T00:00:00.000Z");

export async function createPortableZip(config: ResolvedConfig, logger: Logger): Promise<string> {
  if (!config.portable) {
    throw new AhkBuildError("PORTABLE_DISABLED", "Portable ZIP packaging is not configured.");
  }

  const output = getPortableOutput(config);
  const manifest = await resolveArchiveManifest(config);

  await ensureDirectory(path.dirname(output));
  await fsPromises.rm(output, { force: true });

  const zip = new yazl.ZipFile();
  for (const entry of manifest) {
    zip.addFile(entry.source, entry.destination, {
      mtime: REPRODUCIBLE_MTIME,
      mode: 0o100644,
      compress: true,
    });
  }

  const completed = new Promise<void>((resolve, reject) => {
    const stream = fs.createWriteStream(output);
    stream.once("close", resolve);
    stream.once("error", reject);
    zip.outputStream.once("error", reject).pipe(stream);
  });

  zip.end({ forceZip64Format: false });
  await completed;
  logger.success(`Created ${output}`);
  return output;
}
