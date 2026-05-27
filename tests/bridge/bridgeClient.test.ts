import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { sendStatusToBridge } from "../../src/bridge/bridgeClient";

let server: ReturnType<typeof createServer> | undefined;

afterEach(() => server?.close());

async function listen(serverToStart: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve) => serverToStart.listen(0, "127.0.0.1", resolve));
  const address = serverToStart.address();
  if (!address || typeof address === "string") throw new Error("missing port");
  return address.port;
}

describe("bridge client", () => {
  it("sends normalized status to a local bridge", async () => {
    server = createServer(async (req, res) => {
      expect(req.url).toBe("/status");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      expect(body.status).toBe("loading");
      expect(body.normalizedFrom).toBe("working");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });

    const port = await listen(server);
    const result = await sendStatusToBridge({ port, timeoutMs: 500 }, { status: "working", task: "test" });
    expect(result.ok).toBe(true);
  });

  it("returns PET_APP_UNREACHABLE for closed port", async () => {
    const result = await sendStatusToBridge({ port: 9, timeoutMs: 100 }, { status: "loading", task: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("PET_APP_UNREACHABLE");
  });
});
