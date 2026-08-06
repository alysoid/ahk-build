import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function copyFixture(name: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ahk-build-test-"));
  const source = path.resolve("test", "fixtures", name);
  await fs.cp(source, root, { recursive: true });
  return root;
}
