export default {
  entry: "Fixture.ahk",
  app: {
    name: "Fixture App",
    executable: "Fixture.exe",
    artifactName: "Fixture",
    description: "Fixture application",
    copyright: "Copyright (c) 2026, Fixture Author",
  },
  compile: {
    compression: "none",
    includes: ["includes"],
    assets: ["assets/readme.txt", { from: "assets", to: "runtime" }],
  },
  portable: {
    files: [
      { from: "${buildDir}/Fixture.exe", to: "Fixture.exe" },
      "LICENSE",
      { from: "assets", to: "assets" },
    ],
  },
  wix: false,
  release: false,
};
