import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/install-cline-status-integration.ps1";

function runPowerShell(args: string[]) {
  return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

describe("install-cline-status-integration.ps1", () => {
  it("passes PowerShell parser validation", () => {
    const output = runPowerShell([
      "-Command",
      `$errors = $null; [System.Management.Automation.Language.Parser]::ParseFile('${scriptPath}', [ref]$null, [ref]$errors) | Out-Null; if ($errors.Count) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }; 'parser-ok'`
    ]);

    expect(output).toContain("parser-ok");
  });

  it("installs the rule and updates MCP settings without removing existing servers", () => {
    const root = mkdtempSync(join(tmpdir(), "cline-pet-setup-"));
    const rulesDir = join(root, "Rules");
    const settingsPath = join(root, "settings", "cline_mcp_settings.json");
    mkdirSync(join(root, "settings"), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({
      mcpServers: {
        existing: { command: "cmd", args: ["/c", "echo", "ok"], disabled: false, autoApprove: [] }
      }
    }, null, 2), "utf8");

    runPowerShell([
      "-File",
      scriptPath,
      "-RulesDir",
      rulesDir,
      "-McpSettingsPath",
      settingsPath,
      "-ProjectRoot",
      process.cwd()
    ]);

    const rule = readFileSync(join(rulesDir, "cline-desktop-pet.md"), "utf8");
    expect(rule).toContain("update_pet_status");

    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(settings.mcpServers.existing).toEqual({ command: "cmd", args: ["/c", "echo", "ok"], disabled: false, autoApprove: [] });
    expect(settings.mcpServers["cline-desktop-pet"]).toEqual({
      command: "cmd",
      args: ["/c", "npm", "--prefix", process.cwd(), "run", "dev:mcp"],
      disabled: false,
      autoApprove: ["update_pet_status", "pet_status_check"]
    });
  });
});