import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(projectRoot, "src/assets/default-pet");
const outputDir = join(projectRoot, "dist/assets/default-pet");

if (!existsSync(sourceDir)) {
  throw new Error(`Default pet assets not found: ${sourceDir}`);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(dirname(outputDir), { recursive: true });
cpSync(sourceDir, outputDir, { recursive: true });

console.log(`Copied default pet assets to ${outputDir}`);