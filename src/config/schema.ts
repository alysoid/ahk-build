import { z } from "zod";

const commandSpecSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  cwd: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const managedToolSpecSchema = z.object({
  version: z.string().min(1).optional(),
  url: z.url().optional(),
  sha256: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional(),
  executable: z.string().min(1).optional(),
});

const managedToolchainSchema = z.object({
  provider: z.literal("managed").optional(),
  autoHotkey: managedToolSpecSchema.optional(),
  ahk2exe: managedToolSpecSchema.optional(),
  upx: z.union([z.literal(false), managedToolSpecSchema]).optional(),
});

const systemToolchainSchema = z.object({
  provider: z.literal("system"),
  autoHotkey: z.string().min(1),
  ahk2exe: z.string().min(1),
  upx: z.string().min(1).optional(),
});

const projectFileSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1).optional(),
});

const hooksSchema = z
  .object({
    beforeSetup: z.array(commandSpecSchema).optional(),
    afterSetup: z.array(commandSpecSchema).optional(),
    beforeCompile: z.array(commandSpecSchema).optional(),
    afterCompile: z.array(commandSpecSchema).optional(),
    beforePackage: z.array(commandSpecSchema).optional(),
    afterPackage: z.array(commandSpecSchema).optional(),
    beforeMsi: z.array(commandSpecSchema).optional(),
    afterMsi: z.array(commandSpecSchema).optional(),
    beforeBuild: z.array(commandSpecSchema).optional(),
    afterBuild: z.array(commandSpecSchema).optional(),
    beforeRelease: z.array(commandSpecSchema).optional(),
    afterRelease: z.array(commandSpecSchema).optional(),
  })
  .optional();

export const configSchema = z.object({
  entry: z.string().min(1),
  app: z.object({
    name: z.string().min(1),
    executable: z.string().min(1),
    artifactName: z.string().min(1).optional(),
    description: z.string().optional(),
    publisher: z.string().optional(),
    copyright: z.string().optional(),
    language: z.string().optional(),
    icon: z.string().min(1).optional(),
    resources: z
      .array(
        z.object({
          source: z.string().min(1),
          id: z.number().int().positive(),
        }),
      )
      .optional(),
  }),
  directories: z
    .object({
      build: z.string().min(1).optional(),
      dist: z.string().min(1).optional(),
      work: z.string().min(1).optional(),
      cache: z.string().min(1).optional(),
    })
    .optional(),
  toolchain: z.union([managedToolchainSchema, systemToolchainSchema]).optional(),
  compile: z
    .object({
      architecture: z.enum(["x64", "x86"]).optional(),
      compression: z.enum(["none", "upx"]).optional(),
      output: z.string().min(1).optional(),
      replacements: z.record(z.string(), z.string()).optional(),
      includes: z.array(z.union([z.string().min(1), projectFileSchema])).optional(),
      assets: z.array(z.union([z.string().min(1), projectFileSchema])).optional(),
      additionalArgs: z.array(z.string()).optional(),
      upxArgs: z.array(z.string()).optional(),
      directives: z.enum(["preserve", "replace"]).optional(),
    })
    .optional(),
  portable: z
    .union([
      z.literal(false),
      z.object({
        output: z.string().min(1).optional(),
        files: z.array(z.union([z.string().min(1), projectFileSchema])).min(1),
        exclude: z.array(z.string().min(1)).optional(),
      }),
    ])
    .optional(),
  wix: z
    .union([
      z.literal(false),
      z.object({
        source: z.string().min(1),
        output: z.string().min(1).optional(),
        architecture: z.enum(["x64", "x86", "arm64"]).optional(),
        executable: z.string().min(1).optional(),
        extensions: z.array(z.string().min(1)).optional(),
        defines: z.record(z.string(), z.string()).optional(),
        additionalArgs: z.array(z.string()).optional(),
      }),
    ])
    .optional(),
  release: z
    .union([
      z.literal(false),
      z.object({
        repository: z.string().min(1),
        tag: z.string().min(1).optional(),
        title: z.string().min(1).optional(),
        notes: z.string().optional(),
        generateNotes: z.boolean().optional(),
        assets: z.array(z.string().min(1)).optional(),
        draft: z.boolean().optional(),
        prerelease: z.boolean().optional(),
        commitMessage: z.string().min(1).optional(),
        signTag: z.boolean().optional(),
      }),
    ])
    .optional(),
  hooks: hooksSchema,
});
