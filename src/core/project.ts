import path from "node:path";

import type { ResolvedConfig } from "../config/types.js";
import type { TemplateContext } from "./template.js";

export function getArtifactName(config: ResolvedConfig): string {
  return config.app.artifactName ?? path.parse(config.app.executable).name;
}

export function getCompileOutput(config: ResolvedConfig): string {
  return path.resolve(
    config.root,
    config.compile.output ?? path.join(config.directories.build, config.app.executable),
  );
}

export function createTemplateContext(config: ResolvedConfig): TemplateContext {
  return {
    packageName: config.packageMetadata.name,
    packageVersion: config.packageMetadata.version,
    appName: config.app.name,
    artifactName: getArtifactName(config),
    executable: config.app.executable,
    projectRoot: config.root,
    buildDir: config.directories.build,
    distDir: config.directories.dist,
    workDir: config.directories.work,
  };
}
