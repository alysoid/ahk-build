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

export interface CapturedProcess {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export type ProcessRunner = (
  command: string,
  args: string[],
  options: RunProcessOptions,
) => Promise<void>;

export type CaptureProcessRunner = (
  command: string,
  args: string[],
  options: RunProcessOptions,
) => Promise<CapturedProcess>;

export async function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions,
): Promise<void> {
  const result = await executeProcess(command, args, options, options.stdio === "pipe");
  if (result.exitCode === 0) return;

  throw new AhkBuildError(
    "PROCESS_FAILED",
    `${command} exited with ${result.signal ? `signal ${result.signal}` : `code ${result.exitCode ?? "unknown"}`}`,
  );
}

export function captureProcess(
  command: string,
  args: string[],
  options: RunProcessOptions,
): Promise<CapturedProcess> {
  return executeProcess(command, args, options, true);
}

async function executeProcess(
  command: string,
  args: string[],
  options: RunProcessOptions,
  capture: boolean,
): Promise<CapturedProcess> {
  return new Promise<CapturedProcess>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: false,
      windowsHide: false,
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => (stdout += chunk));
    child.stderr?.on("data", (chunk: string) => (stderr += chunk));

    child.once("error", (error) => {
      reject(
        new AhkBuildError("PROCESS_START_FAILED", `Failed to start ${command}: ${error.message}`, {
          cause: error,
        }),
      );
    });

    child.once("exit", (code, signal) => {
      resolve({ exitCode: code, signal, stdout, stderr });
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
