import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (!tag) fail("A release tag is required.");
if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
  fail(`Release tag must use the vX.Y.Z form: ${tag}`);
}

const expected = `v${packageJson.version}`;
if (tag !== expected) {
  fail(`Release tag ${tag} does not match package.json.version ${packageJson.version}.`);
}

console.log(`Verified ${tag} for ${packageJson.name}@${packageJson.version}`);

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
