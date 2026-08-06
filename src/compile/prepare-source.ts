import fs from "node:fs/promises";
import path from "node:path";

import type { ResolvedConfig } from "../config/types.js";
import { ensureDirectory, ensureFile, resolveFrom } from "../core/fs.js";
import type { Logger } from "../core/logger.js";
import { createTemplateContext } from "../core/project.js";
import { interpolate } from "../core/template.js";
import { copyProjectFiles } from "./copy-files.js";

export async function prepareSource(config: ResolvedConfig, logger: Logger): Promise<string> {
  const entry = resolveFrom(config.root, config.entry);
  await ensureFile(entry, "AutoHotkey entry file");

  let source = await fs.readFile(entry, "utf8");
  const context = createTemplateContext(config);
  const replacements = {
    __APP_VERSION__: "${packageVersion}",
    ...config.compile.replacements,
  };

  for (const [token, value] of Object.entries(replacements)) {
    source = source.replaceAll(token, interpolate(value, context));
  }

  if ((config.compile.directives ?? "replace") === "replace") {
    source = source.replace(/^\s*;@Ahk2Exe-[^\r\n]*(?:\r?\n)?/gim, "");
  }

  const generatedDirectory = path.join(config.directories.work, "generated");
  const generatedPath = path.join(
    generatedDirectory,
    `${path.parse(config.entry).name}.generated.ahk`,
  );
  await ensureDirectory(generatedDirectory);
  await copyProjectFiles(config.root, generatedDirectory, config.compile.includes ?? [], {
    missing: "MISSING_INCLUDE",
    unsafe: "UNSAFE_INCLUDE_PATH",
    label: "compile include",
  });

  const directives =
    (config.compile.directives ?? "replace") === "preserve" ? [] : createCompilerDirectives(config);
  const prefix = directives.length ? `${directives.join("\r\n")}\r\n\r\n` : "";
  const generated = `${prefix}${source.replace(/^\uFEFF/, "")}`;
  await fs.writeFile(generatedPath, `\uFEFF${generated}`, "utf8");
  logger.debug(`Generated source: ${generatedPath}`);
  return generatedPath;
}

function createCompilerDirectives(config: ResolvedConfig): string[] {
  const version = config.packageMetadata.version;
  const lines = [
    `;@Ahk2Exe-SetVersion ${escapeDirectiveValue(version)}`,
    `;@Ahk2Exe-SetProductVersion ${escapeDirectiveValue(version)}`,
    `;@Ahk2Exe-SetName ${escapeDirectiveValue(config.app.name)}`,
  ];

  const description = config.app.description ?? config.packageMetadata.description;
  if (description) lines.push(`;@Ahk2Exe-SetDescription ${escapeDirectiveValue(description)}`);
  if (config.app.publisher) {
    lines.push(`;@Ahk2Exe-SetCompanyName ${escapeDirectiveValue(config.app.publisher)}`);
  }
  if (config.app.copyright) {
    lines.push(`;@Ahk2Exe-SetCopyright ${escapeDirectiveValue(config.app.copyright)}`);
  }
  if (config.app.language)
    lines.push(`;@Ahk2Exe-SetLanguage ${escapeDirectiveValue(config.app.language)}`);
  if (config.app.icon) {
    lines.push(
      `;@Ahk2Exe-SetMainIcon ${escapeDirectiveValue(resolveFrom(config.root, config.app.icon))}`,
    );
  }
  for (const resource of config.app.resources ?? []) {
    lines.push(
      `;@Ahk2Exe-AddResource ${escapeDirectiveValue(resolveFrom(config.root, resource.source))}, ${resource.id}`,
    );
  }

  return lines;
}

function escapeDirectiveValue(value: string): string {
  return value.replaceAll(",", "`,");
}
