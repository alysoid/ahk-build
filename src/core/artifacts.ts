import path from "node:path";

import type { ResolvedConfig } from "../config/types.js";
import { createTemplateContext, getArtifactName } from "./project.js";
import { interpolate } from "./template.js";

export function getPortableOutput(config: ResolvedConfig): string {
  const context = createTemplateContext(config);
  return config.portable && config.portable.output
    ? path.resolve(config.root, interpolate(config.portable.output, context))
    : path.join(
        config.directories.dist,
        `${getArtifactName(config)}-${config.packageMetadata.version}.zip`,
      );
}

export function getMsiOutput(config: ResolvedConfig): string {
  const context = createTemplateContext(config);
  return config.wix && config.wix.output
    ? path.resolve(config.root, interpolate(config.wix.output, context))
    : path.join(
        config.directories.dist,
        `${getArtifactName(config)}-${config.packageMetadata.version}.msi`,
      );
}
