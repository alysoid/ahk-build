import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { ManagedToolSpec } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import { ensureDirectory, pathExists } from "../core/fs.js";
import type { Logger } from "../core/logger.js";

export async function downloadAndVerify(
  spec: ManagedToolSpec,
  downloadsDirectory: string,
  logger: Logger,
  force = false,
): Promise<string> {
  await ensureDirectory(downloadsDirectory);
  const filename = `${sanitize(spec.executable)}-${sanitize(spec.version)}-${spec.sha256.slice(0, 12)}.zip`;
  const archivePath = path.join(downloadsDirectory, filename);

  if (!force && (await pathExists(archivePath))) {
    await verifySha256(archivePath, spec.sha256);
    logger.debug(`Using cached ${archivePath}`);
    return archivePath;
  }

  logger.info(`Downloading ${spec.executable} ${spec.version}...`);
  const response = await fetch(spec.url, {
    headers: { "User-Agent": "@alysoid/ahk-build" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new AhkBuildError(
      "DOWNLOAD_FAILED",
      `Download failed (${response.status} ${response.statusText}): ${spec.url}`,
    );
  }

  const temporaryPath = `${archivePath}.tmp-${process.pid}`;
  await fs.writeFile(temporaryPath, Buffer.from(await response.arrayBuffer()));

  try {
    await verifySha256(temporaryPath, spec.sha256);
    await fs.rm(archivePath, { force: true });
    await fs.rename(temporaryPath, archivePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }

  return archivePath;
}

export async function verifySha256(filePath: string, expected: string): Promise<void> {
  const contents = await fs.readFile(filePath);
  const actual = crypto.createHash("sha256").update(contents).digest("hex");

  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new AhkBuildError(
      "CHECKSUM_MISMATCH",
      `Checksum mismatch for ${filePath}: expected ${expected}, got ${actual}`,
    );
  }
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-");
}
