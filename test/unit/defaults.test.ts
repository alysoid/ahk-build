import { describe, expect, it } from "vitest";

import { DEFAULT_AUTOHOTKEY } from "../../src/config/defaults.js";

describe("managed tool defaults", () => {
  it("uses the official AutoHotkey GitHub release asset", () => {
    expect(DEFAULT_AUTOHOTKEY).toMatchObject({
      version: "2.0.26",
      url: "https://github.com/AutoHotkey/AutoHotkey/releases/download/v2.0.26/AutoHotkey_2.0.26.zip",
      sha256: "43522aa3122a57784ac5db30abf85c2244475c36acd7796e2c993355f9e926ae",
    });
  });
});
