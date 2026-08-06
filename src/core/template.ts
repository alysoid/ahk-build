export interface TemplateContext {
  packageName: string;
  packageVersion: string;
  appName: string;
  artifactName: string;
  executable: string;
  projectRoot: string;
  buildDir: string;
  distDir: string;
  workDir: string;
}

export function interpolate(template: string, context: TemplateContext): string {
  return template.replace(/\$\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, key: string) => {
    if (!(key in context)) return match;
    return context[key as keyof TemplateContext];
  });
}
