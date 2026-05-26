import { existsSync } from "node:fs";

export type DiagnosticsInput = {
  bridgePort: number;
  selectedPetPackId: string;
  selectedPetPackValid: boolean;
  lastUpdateAt?: string;
  lastError?: string | null;
  logs: { app: string; mcp: string };
};

export function buildDiagnosticsReport(input: DiagnosticsInput) {
  return {
    ok: input.selectedPetPackValid && Boolean(input.bridgePort),
    appReachable: true,
    bridgeReachable: Boolean(input.bridgePort),
    mcpReachable: true,
    selectedPetPackId: input.selectedPetPackId,
    selectedPetPackValid: input.selectedPetPackValid,
    lastUpdateAt: input.lastUpdateAt ?? null,
    lastError: input.lastError ?? null,
    logs: input.logs,
    logFilesExist: {
      app: existsSync(input.logs.app),
      mcp: existsSync(input.logs.mcp)
    }
  };
}

export function formatDebugReport(report: Record<string, unknown>): string {
  return `Cline Desktop Pet Debug Report\n${JSON.stringify(report, null, 2)}`;
}