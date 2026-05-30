import { describe, expect, it } from "vitest";
import { buildDiagnosticsReport, formatDebugReport } from "../../src/diagnostics/diagnostics";

describe("diagnostics", () => {
  it("builds a report with state model, pet pack, and log info", () => {
    const report = buildDiagnosticsReport({
      bridgePort: 37621,
      selectedPetPackId: "kaka-desktop-pet",
      selectedPetPackValid: true,
      selectedPetPackHasAllStandardStates: true,
      localKakaPetPackPath: "C:/Users/example/AppData/Roaming/cline-desktop-pet/pets/kaka-desktop-pet",
      localKakaPetPackInstalled: true,
      currentState: {
        status: "loading",
        visibleStatus: "loading",
        baseStatus: "loading",
        overlayStatus: null,
        task: "test",
        source: "cline"
      },
      logs: { app: "app.log", mcp: "mcp.log" }
    });
    expect(report.selectedPetPackId).toBe("kaka-desktop-pet");
    expect(report.selectedPetPackHasAllStandardStates).toBe(true);
    expect(report.currentState.visibleStatus).toBe("loading");
    expect(report.localKakaPetPackInstalled).toBe(true);
  });

  it("formats a copyable debug report", () => {
    const text = formatDebugReport({ selectedPetPackId: "default-pixel-dev" });
    expect(text).toContain("Cline Desktop Pet Debug Report");
    expect(text).toContain("default-pixel-dev");
  });
});
