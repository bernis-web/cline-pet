import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { sendStatusToBridge } from "../bridge/bridgeClient.js";
import { ERROR_CODES, fail, ok } from "../shared/errors.js";
import type { ToolResult } from "../shared/errors.js";
import { updatePetStatusSchema } from "../shared/schemas.js";
import { LEGACY_PET_STATUSES, PET_STATUSES } from "../shared/statuses.js";

const bridgePort = Number(process.env.CLINE_PET_BRIDGE_PORT ?? "37621");

export const updatePetStatusInputSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: [...PET_STATUSES, ...LEGACY_PET_STATUSES] },
    layer: { type: "string", enum: ["base", "overlay"] },
    durationMs: { type: "number" },
    task: { type: "string" },
    message: { type: "string" },
    source: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["status"]
} as const;

export async function handleUpdatePetStatus(
  input: unknown,
  sender = (payload: any) => sendStatusToBridge({ port: bridgePort, timeoutMs: 1200 }, payload)
): Promise<ToolResult<{ delivered: boolean; status: string; visibleStatus: string; baseStatus: string; overlayStatus: string | null; updatedAt: string; normalizedFrom?: string }>> {
  const parsed = updatePetStatusSchema.safeParse(input);
  if (!parsed.success) return fail(ERROR_CODES.INVALID_STATUS, parsed.error.message);
  const payload = { ...parsed.data, updatedAt: parsed.data.updatedAt ?? new Date().toISOString() };
  const delivered = await sender(payload);
  if (!delivered.ok) return delivered;
  return ok({
    delivered: delivered.data.delivered,
    status: payload.status,
    visibleStatus: payload.visibleStatus,
    baseStatus: payload.baseStatus,
    overlayStatus: payload.overlayStatus,
    updatedAt: payload.updatedAt,
    ...(payload.normalizedFrom ? { normalizedFrom: payload.normalizedFrom } : {})
  });
}

export async function startMcpServer() {
  const server = new Server({ name: "cline-desktop-pet", version: "0.1.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "update_pet_status",
        description: "Update the Cline desktop pet status.",
        inputSchema: updatePetStatusInputSchema
      },
      {
        name: "pet_status_check",
        description: "Check Cline desktop pet diagnostics.",
        inputSchema: { type: "object", properties: {} }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "update_pet_status") {
      const result = await handleUpdatePetStatus(request.params.arguments ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    if (request.params.name === "pet_status_check") {
      const response = await fetch(`http://127.0.0.1:${bridgePort}/diagnostics`).catch(() => null);
      const text = response ? await response.text() : JSON.stringify({ ok: false, errorCode: "PET_APP_UNREACHABLE" });
      return { content: [{ type: "text", text }] };
    }
    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
