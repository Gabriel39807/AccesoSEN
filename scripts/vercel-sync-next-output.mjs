import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "apps", "web");
const sourceStandalone = path.join(webRoot, ".next", "standalone");
const sourceNext = path.join(webRoot, ".next");
const targetNext = path.join(repoRoot, ".next");
const sourcePublic = path.join(webRoot, "public");
const targetPublic = path.join(repoRoot, "public");
const sourceStandaloneNodeModules = path.join(sourceStandalone, "node_modules");
const targetNodeModules = path.join(repoRoot, "node_modules");
const sourceStandaloneServer = path.join(sourceStandalone, "server.js");
const targetStandaloneServer = path.join(repoRoot, "server.js");
const sourceStandalonePackageJson = path.join(sourceStandalone, "package.json");
const targetStandalonePackageJson = path.join(repoRoot, "package.json");

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

copyDir(sourceNext, targetNext, "apps/web/.next to root/.next");
copyDir(sourceStandaloneNodeModules, targetNodeModules, "apps/web/.next/standalone/node_modules to root/node_modules");
copyFile(sourceStandaloneServer, targetStandaloneServer, "apps/web/.next/standalone/server.js to root/server.js");
copyFile(sourceStandalonePackageJson, targetStandalonePackageJson, "apps/web/.next/standalone/package.json to root/package.json");

if (fs.existsSync(sourcePublic)) {
  copyDir(sourcePublic, targetPublic, "apps/web/public to root/public");
}

console.log("[vercel-build] Synced Next.js build output and standalone runtime artifacts to repository root.");
