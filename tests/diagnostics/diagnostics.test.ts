import { describe, expect, it } from "vitest";
import { buildDiagnosticsReport, formatDebugReport } from "../../src/diagnostics/diagnostics";

describe("diagnostics", () => {
  it("builds a report with pet pack and log info", () => {
    const report = buildDiagnosticsReport({
      bridgePort: 37621,
      selectedPetPackId: "default-pixel-dev",
      selectedPetPackValid: true,
      logs: { app: "app.log", mcp: "mcp.log" }
    });
    expect(report.selectedPetPackId).toBe("default-pixel-dev");
    expect(report.bridgeReachable).toBe(true);
  });

  it("formats a copyable debug report", () => {
    const text = formatDebugReport({ selectedPetPackId: "default-pixel-dev" });
    expect(text).toContain("Cline Desktop Pet Debug Report");
    expect(text).toContain("default-pixel-dev");
  });
});