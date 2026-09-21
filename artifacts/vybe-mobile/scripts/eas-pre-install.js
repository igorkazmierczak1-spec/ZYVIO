const fs = require("node:fs");
const path = require("node:path");

if (!process.env.EAS_BUILD && !process.env.EAS_BUILD_PROFILE) {
  process.exit(0);
}

let directory = process.cwd();
let workspaceRoot = null;

while (true) {
  if (fs.existsSync(path.join(directory, "pnpm-workspace.yaml"))) {
    workspaceRoot = directory;
    break;
  }

  const parent = path.dirname(directory);
  if (parent === directory) break;
  directory = parent;
}

if (!workspaceRoot) {
  process.exit(0);
}

const npmrcPath = path.join(workspaceRoot, ".npmrc");
const allowedBuildDependencies = [
  "@swc/core",
  "@clerk/shared",
  "browser-tabs-lock",
  "core-js",
  "esbuild",
  "msw",
  "unrs-resolver",
];
const existing = fs.existsSync(npmrcPath) ? fs.readFileSync(npmrcPath, "utf8") : "";
const additions = allowedBuildDependencies
  .filter((name) => !existing.split(/\r?\n/).some((line) => line.trim() === `only-built-dependencies[]=${name}`))
  .map((name) => `only-built-dependencies[]=${name}`)
  .join("\n");

if (additions) {
  fs.writeFileSync(npmrcPath, `${existing.replace(/\s*$/, "")}\n${additions}\n`);
}