import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "apps", "web");
const sourceStandalone = path.join(webRoot, ".next", "standalone");
const sourceNext = path.join(webRoot, ".next");
const targetNext = path.join(repoRoot, ".next");
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

function copyFile(sourceFile, targetFile, label) {
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Missing source file: ${sourceFile}`);
  }

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`[vercel-build] Copied ${label}.`);
}

function copyFileIfExists(sourceFile, targetFile, label) {
  if (!fs.existsSync(sourceFile)) {
    console.log(`[vercel-build] Skipped ${label}; source file not present.`);
    return;
  }

  copyFile(sourceFile, targetFile, label);
}

copyDir(sourceNext, targetNext, "apps/web/.next to root/.next");

if (fs.existsSync(sourcePublic)) {
  copyDir(sourcePublic, targetPublic, "apps/web/public to root/public");
}

if (fs.existsSync(sourceStandalone)) {
  console.log("[vercel-build] Skipped standalone runtime sync; Vercel uses the copied .next output directly.");
}

console.log("[vercel-build] Synced Next.js build output to repository root.");
