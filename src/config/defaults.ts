import os from "node:os";
import path from "node:path";

import type { ManagedToolSpec } from "./types.js";

export const DEFAULT_AUTOHOTKEY: ManagedToolSpec = {
  version: "2.0.26",
  url: "https://www.autohotkey.com/download/2.0/AutoHotkey_2.0.26.zip",
  sha256: "43522aa3122a57784ac5db30abf85c2244475c36acd7796e2c993355f9e926ae",
  executable: "AutoHotkey64.exe",
};

export const DEFAULT_AHK2EXE: ManagedToolSpec = {
  version: "1.1.37.02a2",
  url: "https://github.com/AutoHotkey/Ahk2Exe/releases/download/Ahk2Exe1.1.37.02a2/Ahk2Exe1.1.37.02a2.zip",
  sha256: "c29b8c3a5124850d79fc9e66e2ca79677c377d7f31631ad3022ba159c5d9e3be",
  executable: "Ahk2Exe.exe",
};

export const DEFAULT_UPX: ManagedToolSpec = {
  version: "5.2.0",
  url: "https://github.com/upx/upx/releases/download/v5.2.0/upx-5.2.0-win64.zip",
  sha256: "b471ebf1b7f20f4a89150264ed9a008a2a5bfd247f3c6d1184a75bb59ca08f5d",
  executable: "upx.exe",
};

export function getDefaultCacheDirectory(): string {
  const override = process.env.AHK_BUILD_CACHE_DIR;
  if (override) return path.resolve(override);

  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA ?? os.homedir(), "ahk-build", "cache");
  }

  return path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"), "ahk-build");
}
