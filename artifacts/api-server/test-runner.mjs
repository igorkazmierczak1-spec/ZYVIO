import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const outputDir = ".test-build";
const outputFile = `${outputDir}/viral-core.test.mjs`;

await mkdir(outputDir, { recursive: true });
await build({
  entryPoints: ["test/viral-core.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  outfile: outputFile,
  sourcemap: "inline",
  logLevel: "warning",
});

const child = spawn(process.execPath, ["--test", outputFile], {
  stdio: "inherit",
  env: process.env,
});
const exitCode = await new Promise((resolve) => {
  child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
});

await rm(outputDir, { recursive: true, force: true });
process.exit(exitCode);