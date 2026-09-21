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

const allowedBuildDependencies = [
  "@swc/core",
  "@clerk/shared",
  "browser-tabs-lock",
  "core-js",
  "esbuild",
  "msw",
  "unrs-resolver",
];

const workspaceConfigPath = path.join(workspaceRoot, "pnpm-workspace.yaml");
const existing = fs.readFileSync(workspaceConfigPath, "utf8");
const lines = existing.split(/\r?\n/);
const sectionIndex = lines.findIndex((line) => /^onlyBuiltDependencies:\s*$/.test(line));

if (sectionIndex === -1) {
  lines.push("", "onlyBuiltDependencies:", ...allowedBuildDependencies.map((name) => `  - '${name}'`));
} else {
  let sectionEnd = sectionIndex + 1;
  while (sectionEnd < lines.length && (/^\s/.test(lines[sectionEnd]) || lines[sectionEnd].trim() === "")) {
    sectionEnd += 1;
  }

  const section = lines.slice(sectionIndex + 1, sectionEnd).join("\n");
  const additions = allowedBuildDependencies
    .filter((name) => !new RegExp(`^\\s*-\\s*['"]?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]?\\s*$`, "m").test(section))
    .map((name) => `  - '${name}'`);
  lines.splice(sectionEnd, 0, ...additions);
}

fs.writeFileSync(workspaceConfigPath, `${lines.join("\n").replace(/\s*$/, "")}\n`);