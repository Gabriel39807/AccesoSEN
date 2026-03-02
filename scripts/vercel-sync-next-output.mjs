import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "apps", "web");
const sourceNext = path.join(webRoot, ".next");
const targetNext = path.join(repoRoot, ".next");
const sourcePublic = path.join(webRoot, "public");
const targetPublic = path.join(repoRoot, "public");

function linkOrCopyDir(sourceDir, targetDir, label) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing source directory: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });

  try {
    fs.symlinkSync(sourceDir, targetDir, "dir");
    console.log(`[vercel-build] Linked ${label}.`);
  } catch {
    fs.cpSync(sourceDir, targetDir, { recursive: true });
    console.log(`[vercel-build] Copied ${label}.`);
  }
}

linkOrCopyDir(sourceNext, targetNext, "apps/web/.next to root/.next");

if (fs.existsSync(sourcePublic)) {
  linkOrCopyDir(sourcePublic, targetPublic, "apps/web/public to root/public");
}

console.log("[vercel-build] Synced apps/web build artifacts to repository root.");
