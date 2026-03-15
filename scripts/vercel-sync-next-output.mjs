import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "apps", "web");
const sourceNext = path.join(webRoot, ".next");
const targetNext = path.join(repoRoot, ".next");
const sourcePublic = path.join(webRoot, "public");
const targetPublic = path.join(repoRoot, "public");
const sourceNodeModules = path.join(webRoot, "node_modules");
const targetNodeModules = path.join(repoRoot, "node_modules");

function copyDir(sourceDir, targetDir, label) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing source directory: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log(`[vercel-build] Copied ${label}.`);
}

copyDir(sourceNext, targetNext, "apps/web/.next to root/.next");

if (fs.existsSync(sourcePublic)) {
  copyDir(sourcePublic, targetPublic, "apps/web/public to root/public");
}

copyDir(sourceNodeModules, targetNodeModules, "apps/web/node_modules to root/node_modules");

console.log("[vercel-build] Synced apps/web artifacts and traced dependencies to repository root.");
