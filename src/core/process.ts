import { spawn } from "node:child_process";
import path from "node:path";

import type { CommandSpec } from "../config/types.js";
import { AhkBuildError } from "./errors.js";
import type { Logger } from "./logger.js";

export interface RunProcessOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  stdio?: "inherit" | "pipe";
}

export async function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
      shell: false,
      windowsHide: false,
    });

    child.once("error", (error) => {
      reject(
        new AhkBuildError("PROCESS_START_FAILED", `Failed to start ${command}: ${error.message}`, {
          cause: error,
        }),
      );
    });

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new AhkBuildError(
          "PROCESS_FAILED",
          `${command} exited with ${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`}`,
        ),
      );
    });
  });
}

export async function runCommandSpec(
  spec: CommandSpec,
  projectRoot: string,
  logger: Logger,
): Promise<void> {
  const cwd = spec.cwd ? path.resolve(projectRoot, spec.cwd) : projectRoot;
  logger.info(`> ${spec.command}${spec.args?.length ? ` ${spec.args.join(" ")}` : ""}`);
  await runProcess(spec.command, spec.args ?? [], {
    cwd,
    env: { ...process.env, ...spec.env },
  });
}
