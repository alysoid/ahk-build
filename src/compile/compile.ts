import path from "node:path";

import type { ResolvedConfig } from "../config/types.js";
import { AhkBuildError } from "../core/errors.js";
import { ensureDirectory, ensureFile } from "../core/fs.js";
import type { Logger } from "../core/logger.js";
import { getCompileOutput } from "../core/project.js";
import { runProcess } from "../core/process.js";
import { resolveToolchain } from "../toolchain/provider.js";
import { copyProjectFiles } from "./copy-files.js";
import { prepareSource } from "./prepare-source.js";

export async function compileProject(config: ResolvedConfig, logger: Logger): Promise<string> {
  if (process.platform !== "win32") {
    throw new AhkBuildError("WINDOWS_REQUIRED", "AutoHotkey compilation requires Windows.");
  }

  const toolchain = await resolveToolchain(config, logger, { install: true });
  const generatedSource = await prepareSource(config, logger);
  const output = getCompileOutput(config);
  await ensureDirectory(path.dirname(output));

  const args = [
    "/in",
    generatedSource,
    "/out",
    output,
    "/base",
    toolchain.autoHotkey,
    ...(config.compile.additionalArgs ?? []),
    "/compress",
    "0",
    "/silent",
  ];

  logger.info(`Compiling ${config.entry}...`);
  await runProcess(toolchain.ahk2exe, args, { cwd: config.root });
  await ensureFile(output, "compiled executable");
  await copyProjectFiles(config.root, path.dirname(output), config.compile.assets ?? [], {
    missing: "MISSING_COMPILE_ASSET",
    unsafe: "UNSAFE_COMPILE_ASSET_PATH",
    label: "compile asset",
  });

  if (config.compile.compression === "upx") {
    if (!toolchain.upx) {
      throw new AhkBuildError(
        "UPX_NOT_CONFIGURED",
        "Compression is set to upx, but the selected toolchain does not provide UPX.",
      );
    }
    logger.info(`Compressing ${path.basename(output)} with UPX...`);
    await runProcess(toolchain.upx, [...(config.compile.upxArgs ?? ["--best"]), output], {
      cwd: config.root,
    });
  }

  logger.success(`Compiled ${output}`);
  return output;
}
