import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("local desktop pet launchers", () => {
  it("provides a dedicated silent launcher entrypoint", () => {
    const launcherPath = join(projectRoot, "start-cline-pet.vbs");

    expect(existsSync(launcherPath)).toBe(true);

    const launcher = readFileSync(launcherPath, "utf8");
    expect(launcher).toContain("WScript.Shell");
    expect(launcher).toContain("start-cline-pet.ps1");
  });

  it("routes the batch launcher through the silent entrypoint without pausing", () => {
    const launcher = readFileSync(join(projectRoot, "start-cline-pet.bat"), "utf8");

    expect(launcher).toContain("wscript.exe");
    expect(launcher).toContain("start-cline-pet.vbs");
    expect(launcher.toLowerCase()).not.toContain("pause");
    expect(launcher).not.toContain("powershell -NoProfile -ExecutionPolicy Bypass -File");
  });

  it("relaunches the PowerShell launcher hidden when started directly", () => {
    const launcher = readFileSync(join(projectRoot, "start-cline-pet.ps1"), "utf8");

    expect(launcher).toContain("-WindowStyle Hidden");
    expect(launcher).toContain("CLINE_PET_HIDDEN_LAUNCH");
  });
});