import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "apps", "web");
const sourceStandalone = path.join(webRoot, ".next", "standalone");
const targetNext = path.join(repoRoot, ".next");
const sourceStatic = path.join(webRoot, ".next", "static");
const targetStatic = path.join(targetNext, "static");
const sourcePublic = path.join(webRoot, "public");
const targetPublic = path.join(repoRoot, "public");

function copyDir(sourceDir, targetDir, label) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing source directory: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log(`[vercel-build] Copied ${label}.`);
}

function copyDirContents(sourceDir, targetDir, label) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing source directory: ${sourceDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir)) {
    fs.cpSync(path.join(sourceDir, entry), path.join(targetDir, entry), { recursive: true, force: true });
  }
  console.log(`[vercel-build] Copied ${label}.`);
}

copyDirContents(sourceStandalone, repoRoot, "apps/web/.next/standalone contents to repository root");
copyDir(sourceStatic, targetStatic, "apps/web/.next/static to root/.next/static");

if (fs.existsSync(sourcePublic)) {
  copyDir(sourcePublic, targetPublic, "apps/web/public to root/public");
}

console.log("[vercel-build] Synced standalone output and static assets to repository root.");
