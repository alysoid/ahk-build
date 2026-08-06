import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

import { AhkBuildError } from "../core/errors.js";
import { pathExists, resolveFrom } from "../core/fs.js";
import { getDefaultCacheDirectory } from "./defaults.js";
import { configSchema } from "./schema.js";
import type { AhkBuildConfig, PackageMetadata, ResolvedConfig } from "./types.js";

const packageSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  license: z.string().optional(),
  repository: z.union([z.string(), z.object({ url: z.string().optional() })]).optional(),
});

const CONFIG_NAMES = [
  "ahk-build.config.ts",
  "ahk-build.config.mts",
  "ahk-build.config.js",
  "ahk-build.config.mjs",
] as const;

export interface LoadConfigOptions {
  cwd?: string;
  configPath?: string;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<ResolvedConfig> {
  const root = path.resolve(options.cwd ?? process.cwd());
  const packagePath = path.join(root, "package.json");

  if (!(await pathExists(packagePath))) {
    throw new AhkBuildError("PACKAGE_NOT_FOUND", `No package.json found in ${root}`);
  }

  const packageMetadata = packageSchema.parse(
    JSON.parse(await fs.readFile(packagePath, "utf8")) as unknown,
  ) as PackageMetadata;

  const configPath = options.configPath
    ? resolveFrom(root, options.configPath)
    : await findConfigPath(root);

  const loaded = (await import(pathToFileURL(configPath).href)) as unknown;
  const candidate = unwrapDefault(loaded);

  let config: AhkBuildConfig;
  try {
    config = configSchema.parse(candidate) as AhkBuildConfig;
  } catch (error) {
    throw new AhkBuildError("INVALID_CONFIG", `Invalid configuration in ${configPath}`, {
      cause: error,
    });
  }

  const buildDirectory = resolveFrom(root, config.directories?.build ?? "build");
  const distDirectory = resolveFrom(root, config.directories?.dist ?? "dist");
  const workDirectory = resolveFrom(root, config.directories?.work ?? ".ahk-build");
  const cacheDirectory = config.directories?.cache
    ? resolveFrom(root, config.directories.cache)
    : getDefaultCacheDirectory();

  return {
    ...config,
    root,
    configPath,
    packagePath,
    packageMetadata,
    directories: {
      build: buildDirectory,
      dist: distDirectory,
      work: workDirectory,
      cache: cacheDirectory,
    },
    toolchain: config.toolchain ?? { provider: "managed" },
    compile: {
      ...config.compile,
      architecture: config.compile?.architecture ?? "x64",
      compression: config.compile?.compression ?? "none",
    },
  };
}

async function findConfigPath(root: string): Promise<string> {
  for (const name of CONFIG_NAMES) {
    const candidate = path.join(root, name);
    if (await pathExists(candidate)) return candidate;
  }

  throw new AhkBuildError(
    "CONFIG_NOT_FOUND",
    `No ahk-build configuration found in ${root}. Expected one of: ${CONFIG_NAMES.join(", ")}`,
  );
}

function unwrapDefault(value: unknown): unknown {
  if (typeof value === "object" && value !== null && "default" in value) {
    return value.default;
  }
  return value;
}
