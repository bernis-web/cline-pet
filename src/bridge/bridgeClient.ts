import { ERROR_CODES, fail, ok } from "../shared/errors.js";
import type { ToolResult } from "../shared/errors.js";
import { updatePetStatusSchema } from "../shared/schemas.js";
import type { BridgeConfig, BridgeStatusPayload } from "./bridgeTypes.js";

export async function sendStatusToBridge(config: BridgeConfig, payload: BridgeStatusPayload): Promise<ToolResult<{ delivered: true }>> {
  const parsed = updatePetStatusSchema.safeParse(payload);
  if (!parsed.success) return fail(ERROR_CODES.INVALID_STATUS, parsed.error.message);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`http://${config.host ?? "127.0.0.1"}:${config.port}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal: controller.signal
    });
    if (!response.ok) return fail(ERROR_CODES.BRIDGE_UNREACHABLE, `Bridge returned ${response.status}`);
    return ok({ delivered: true });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return fail(aborted ? ERROR_CODES.TIMEOUT : ERROR_CODES.PET_APP_UNREACHABLE, aborted ? "Bridge request timed out" : "Pet app bridge is unreachable");
  } finally {
    clearTimeout(timeout);
  }
}