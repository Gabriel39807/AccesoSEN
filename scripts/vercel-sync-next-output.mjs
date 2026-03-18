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
const targetTraceManifests = [
  path.join(targetNext, "next-server.js.nft.json"),
  path.join(targetNext, "next-minimal-server.js.nft.json"),
];

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

function rewriteRootTraceManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    console.log(`[vercel-build] Skipped trace rewrite; manifest not present: ${path.basename(manifestPath)}.`);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.files)) {
    console.log(`[vercel-build] Skipped trace rewrite; manifest has no files array: ${path.basename(manifestPath)}.`);
    return;
  }

  manifest.files = manifest.files.map((entry) => (
    typeof entry === "string" && entry.startsWith("../node_modules/")
      ? entry.slice(3)
      : entry
  ));

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  console.log(`[vercel-build] Rewrote root trace paths in ${path.basename(manifestPath)}.`);
}

copyDir(sourceNext, targetNext, "apps/web/.next to root/.next");

if (fs.existsSync(sourcePublic)) {
  copyDir(sourcePublic, targetPublic, "apps/web/public to root/public");
}

if (fs.existsSync(sourceStandaloneNodeModules)) {
  copyDir(sourceStandaloneNodeModules, targetNodeModules, "apps/web/.next/standalone/node_modules to root/node_modules");
} else if (fs.existsSync(sourceStandalone)) {
  console.log("[vercel-build] Standalone directory present but node_modules trace was not found.");
}

for (const manifestPath of targetTraceManifests) {
  rewriteRootTraceManifest(manifestPath);
}

console.log("[vercel-build] Synced Next.js build output to repository root.");
