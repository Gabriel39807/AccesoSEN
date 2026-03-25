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
const sourceWebNodeModules = path.join(webRoot, "node_modules");
const targetNodeModules = path.join(repoRoot, "node_modules");

function copyDir(sourceDir, targetDir, label, options = {}) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing source directory: ${sourceDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, ...options });
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

function ensureTraceDependenciesFromNft() {
  if (!fs.existsSync(sourceWebNodeModules)) {
    console.log("[vercel-build] Skipped NFT dependency sync; apps/web/node_modules is missing.");
    return;
  }

  const nftFiles = fs
    .readdirSync(sourceNext, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".nft.json"))
    .map((entry) => path.join(entry.parentPath ?? sourceNext, entry.name));

  const copiedRoots = new Set();

  for (const nftFile of nftFiles) {
    const payload = JSON.parse(fs.readFileSync(nftFile, "utf8"));
    const files = Array.isArray(payload.files) ? payload.files : [];

    for (const relativeFile of files) {
      if (typeof relativeFile !== "string" || !relativeFile.startsWith("../node_modules/")) {
        continue;
      }

      const normalizedRelative = relativeFile.slice("../node_modules/".length);
      const packageRoot = normalizedRelative.startsWith("@")
        ? normalizedRelative.split(path.sep).slice(0, 2).join(path.sep)
        : normalizedRelative.split(path.sep)[0];

      if (!packageRoot || copiedRoots.has(packageRoot)) {
        continue;
      }

      const sourcePackagePath = path.join(sourceWebNodeModules, packageRoot);
      const targetPackagePath = path.join(targetNodeModules, packageRoot);

      if (!fs.existsSync(sourcePackagePath)) {
        console.log(`[vercel-build] NFT dependency missing in apps/web/node_modules: ${packageRoot}`);
        continue;
      }

      fs.mkdirSync(path.dirname(targetPackagePath), { recursive: true });
      fs.cpSync(sourcePackagePath, targetPackagePath, {
        recursive: true,
        dereference: true,
        force: true,
      });

      copiedRoots.add(packageRoot);
    }
  }

  if (copiedRoots.size > 0) {
    console.log(`[vercel-build] Synced ${copiedRoots.size} traced node_modules package(s) from apps/web.`);
  }
}

copyDir(sourceNext, targetNext, "apps/web/.next to root/.next");

if (fs.existsSync(sourcePublic)) {
  copyDir(sourcePublic, targetPublic, "apps/web/public to root/public");
}

if (fs.existsSync(sourceStandaloneNodeModules)) {
  copyDir(sourceStandaloneNodeModules, targetNodeModules, "apps/web/.next/standalone/node_modules to root/node_modules", {
    dereference: true,
  });
} else if (fs.existsSync(sourceStandalone)) {
  console.log("[vercel-build] Standalone directory present but node_modules trace was not found.");
}

ensureTraceDependenciesFromNft();

console.log("[vercel-build] Synced Next.js build output to repository root.");
