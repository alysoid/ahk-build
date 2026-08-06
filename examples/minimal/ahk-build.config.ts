import { defineConfig } from "@alysoid/ahk-build";

export default defineConfig({
  entry: "MinimalApp.ahk",
  app: {
    name: "Minimal AHK App",
    executable: "MinimalApp.exe",
    artifactName: "MinimalApp",
    description: "Minimal @alysoid/ahk-build example",
    publisher: "Andrea Brandi",
  },
  compile: {
    compression: "none",
  },
  portable: {
    files: [{ from: "${buildDir}/MinimalApp.exe", to: "MinimalApp.exe" }, "LICENSE"],
  },
  wix: false,
  release: false,
});
