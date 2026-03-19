import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const stubFiles = [
  ".next/types/cache-life.d.ts",
  ".next/dev/types/cache-life.d.ts",
];

for (const relativePath of stubFiles) {
  const fullPath = resolve(root, relativePath);
  if (existsSync(fullPath)) continue;
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, "export {};\n", "utf8");
}
