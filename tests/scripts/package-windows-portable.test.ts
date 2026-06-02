import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("Windows portable release packaging", () => {
  it("exposes npm scripts for copying bundled assets and building the portable package", () => {
    const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["build:assets"]).toBe("node scripts/copy-default-pet-assets.mjs");
    expect(packageJson.scripts["package:win:portable"]).toBe("npm run build && node scripts/package-windows-portable.mjs");
  });

  it("copies the default pet assets into the built app directory", () => {
    const scriptPath = join(projectRoot, "scripts", "copy-default-pet-assets.mjs");

    expect(existsSync(scriptPath)).toBe(true);

    const script = readFileSync(scriptPath, "utf8");
    expect(script).toContain("src/assets/default-pet");
    expect(script).toContain("dist/assets/default-pet");
  });

  it("builds a self-contained Electron portable app with runtime dependencies", () => {
    const scriptPath = join(projectRoot, "scripts", "package-windows-portable.mjs");

    expect(existsSync(scriptPath)).toBe(true);

    const script = readFileSync(scriptPath, "utf8");
    expect(script).toContain("node_modules/electron/dist");
    expect(script).toContain("resources/app");
    expect(script).toContain("node_modules/zod");
    expect(script).toContain("Cline Desktop Pet.exe");
    expect(script).toContain("Compress-Archive");
  });
});