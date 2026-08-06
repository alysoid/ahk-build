import fs from "node:fs/promises";

await Promise.all(
  ["dist", "coverage", ".artifacts"].map((path) => fs.rm(path, { force: true, recursive: true })),
);
