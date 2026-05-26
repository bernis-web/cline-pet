import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { updatePetStatusSchema } from "../shared/schemas.js";
import type { UpdatePetStatusInput } from "../shared/schemas.js";

export type BridgeServerHandlers = {
  onStatus(payload: UpdatePetStatusInput): void;
  onDiagnostics(): Record<string, unknown>;
  onShow?(): void;
  onQuit?(): void;
};

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function startBridgeServer(port: number, handlers: BridgeServerHandlers) {
  const server = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/status") {
      const parsed = updatePetStatusSchema.safeParse(await readJson(req));
      if (!parsed.success) return json(res, 400, { ok: false, error: parsed.error.message });
      handlers.onStatus(parsed.data);
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && req.url === "/diagnostics") {
      return json(res, 200, handlers.onDiagnostics());
    }
    if (req.method === "POST" && req.url === "/show") {
      handlers.onShow?.();
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && req.url === "/quit") {
      handlers.onQuit?.();
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { ok: false, error: "not found" });
  });
  server.listen(port, "127.0.0.1");
  return server;
}