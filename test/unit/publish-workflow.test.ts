import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflowPath = path.join(root, ".github", "workflows", "publish.yml");

describe("publish workflow", () => {
  it("uses current action runtimes and OIDC-only npm publishing", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("actions/checkout@v7");
    expect(workflow).toContain("actions/setup-node@v7");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).not.toContain("registry-url:");
    expect(workflow).toContain("package-manager-cache: false");
    expect(workflow).not.toContain("always-auth");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain('npm publish "$TARBALL" --registry=https://registry.npmjs.org');
    expect(workflow).toContain("--provenance");
  });

  it("keeps the release draft until the channel-specific npm publish succeeds", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const npmPublish = workflow.indexOf('npm publish "$TARBALL"');
    const stableDraft = workflow.indexOf("Create stable GitHub Release draft");
    const prereleaseDraft = workflow.indexOf("Create prerelease GitHub Release draft");
    const stablePublish = workflow.indexOf("Publish the prepared stable GitHub Release");
    const prereleasePublish = workflow.indexOf("Publish the prepared prerelease GitHub Release");

    expect(workflow).toContain('echo "npm_tag=next"');
    expect(workflow).toContain('echo "npm_tag=latest"');
    expect(workflow).toContain("--prerelease");
    expect(workflow).toContain("--latest=false");
    expect(workflow).toContain("--latest\n");
    expect(npmPublish).toBeGreaterThan(stableDraft);
    expect(npmPublish).toBeGreaterThan(prereleaseDraft);
    expect(stablePublish).toBeGreaterThan(npmPublish);
    expect(prereleasePublish).toBeGreaterThan(npmPublish);
  });
});
