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

function resetAndCopyDir(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing source directory: ${sourceDir}`);
  }
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function ensureRootNodeModulesLink() {
  if (!fs.existsSync(sourceNodeModules)) {
    throw new Error(`Missing source directory: ${sourceNodeModules}`);
  }

  fs.rmSync(targetNodeModules, { recursive: true, force: true });
  try {
    fs.symlinkSync(sourceNodeModules, targetNodeModules, "dir");
    console.log("[vercel-build] Linked apps/web/node_modules to root.");
  } catch {
    fs.cpSync(sourceNodeModules, targetNodeModules, { recursive: true });
    console.log("[vercel-build] Copied apps/web/node_modules to root.");
  }
}

resetAndCopyDir(sourceNext, targetNext);

if (fs.existsSync(sourcePublic)) {
  resetAndCopyDir(sourcePublic, targetPublic);
}

if (process.env.VERCEL === "1" || process.env.CI === "true") {
  ensureRootNodeModulesLink();
}

console.log("[vercel-build] Synced apps/web build artifacts to repository root.");
