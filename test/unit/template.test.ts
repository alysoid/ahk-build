import { describe, expect, it } from "vitest";

import { interpolate } from "../../src/core/template.js";

describe("interpolate", () => {
  it("replaces known variables and preserves unknown variables", () => {
    const result = interpolate("${artifactName}-${packageVersion}-${unknown}", {
      packageName: "fixture",
      packageVersion: "1.2.3",
      appName: "Fixture App",
      artifactName: "Fixture",
      executable: "Fixture.exe",
      projectRoot: "/repo",
      buildDir: "/repo/build",
      distDir: "/repo/dist",
      workDir: "/repo/.ahk-build",
    });

    expect(result).toBe("Fixture-1.2.3-${unknown}");
  });
});
