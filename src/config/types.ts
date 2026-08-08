export type Architecture = "x64" | "x86";
export type Compression = "none" | "upx";
export type WixArchitecture = "x64" | "x86" | "arm64";

export interface CommandSpec {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export type HookName =
  | "beforeSetup"
  | "afterSetup"
  | "beforeCompile"
  | "afterCompile"
  | "beforePackage"
  | "afterPackage"
  | "beforeMsi"
  | "afterMsi"
  | "beforeBuild"
  | "afterBuild"
  | "beforeRelease"
  | "afterRelease";

export interface CompilerResource {
  source: string;
  id: number;
}

export interface AppConfig {
  name: string;
  executable: string;
  artifactName?: string;
  description?: string;
  publisher?: string;
  copyright?: string;
  language?: string;
  icon?: string;
  resources?: CompilerResource[];
}

export interface DirectoriesConfig {
  build?: string;
  dist?: string;
  work?: string;
  cache?: string;
}

export interface ManagedToolSpec {
  version: string;
  url: string;
  sha256: string;
  executable: string;
}

export interface ManagedToolchainConfig {
  provider?: "managed";
  autoHotkey?: Partial<ManagedToolSpec>;
  ahk2exe?: Partial<ManagedToolSpec>;
  upx?: false | Partial<ManagedToolSpec>;
}

export interface SystemToolchainConfig {
  provider: "system";
  autoHotkey: string;
  ahk2exe: string;
  upx?: string;
}

export type ToolchainConfig = ManagedToolchainConfig | SystemToolchainConfig;

export interface CompileConfig {
  architecture?: Architecture;
  compression?: Compression;
  output?: string;
  replacements?: Record<string, string>;
  includes?: (string | CompileInclude)[];
  assets?: (string | CompileAsset)[];
  additionalArgs?: string[];
  upxArgs?: string[];
  directives?: "preserve" | "replace";
}

interface ProjectFile {
  from: string;
  to?: string;
}

export type CompileInclude = ProjectFile;
export type CompileAsset = ProjectFile;
export type ArchiveEntry = ProjectFile;

export interface PortableConfig {
  output?: string;
  files: (string | ArchiveEntry)[];
  exclude?: string[];
}

export interface WixConfig {
  source: string;
  output?: string;
  architecture?: WixArchitecture;
  executable?: string;
  extensions?: string[];
  defines?: Record<string, string>;
  additionalArgs?: string[];
}

export interface ReleaseConfig {
  repository: string;
  tag?: string;
  title?: string;
  notes?: string;
  assets?: string[];
  draft?: boolean;
  prerelease?: boolean;
  commitMessage?: string;
  signTag?: boolean;
}

export interface AhkBuildConfig {
  entry: string;
  app: AppConfig;
  directories?: DirectoriesConfig;
  toolchain?: ToolchainConfig;
  compile?: CompileConfig;
  portable?: false | PortableConfig;
  wix?: false | WixConfig;
  release?: false | ReleaseConfig;
  hooks?: Partial<Record<HookName, CommandSpec[]>>;
}

export interface PackageMetadata {
  name: string;
  version: string;
  description?: string;
  license?: string;
  repository?: string | { url?: string };
}

export interface ResolvedDirectories {
  build: string;
  dist: string;
  work: string;
  cache: string;
}

export interface ResolvedConfig extends AhkBuildConfig {
  root: string;
  configPath: string;
  packagePath: string;
  packageMetadata: PackageMetadata;
  directories: ResolvedDirectories;
  toolchain: ToolchainConfig;
  compile: Required<Pick<CompileConfig, "architecture" | "compression">> & CompileConfig;
}
