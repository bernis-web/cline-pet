import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startBridgeServer } from "../../src/bridge/bridgeServer";

let server: ReturnType<typeof startBridgeServer> | undefined;

afterEach(() => server?.close());

async function listenOnRandomPort() {
  server = startBridgeServer(0, {
    onStatus: vi.fn(),
    onDiagnostics: () => ({ ok: true }),
    onShow: vi.fn(),
    onQuit: vi.fn()
  });
  await new Promise<void>((resolve) => server?.once("listening", resolve));
  return (server.address() as AddressInfo).port;
}

describe("bridge server control endpoints", () => {
  it("handles /show to make an existing pet window visible", async () => {
    const onShow = vi.fn();
    server = startBridgeServer(0, {
      onStatus: vi.fn(),
      onDiagnostics: () => ({ ok: true }),
      onShow
    });
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/show`, { method: "POST" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(onShow).toHaveBeenCalledOnce();
  });

  it("continues to expose diagnostics", async () => {
    const port = await listenOnRandomPort();

    const response = await fetch(`http://127.0.0.1:${port}/diagnostics`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("normalizes legacy status payloads before invoking onStatus", async () => {
    const onStatus = vi.fn();
    server = startBridgeServer(0, {
      onStatus,
      onDiagnostics: () => ({ ok: true })
    });
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done", task: "complete" })
    });

    expect(response.status).toBe(200);
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({
      status: "happy",
      visibleStatus: "happy",
      baseStatus: "happy",
      overlayStatus: null,
      normalizedFrom: "done"
    }));
  });

  it("reports listen errors without crashing the process", async () => {
    const firstServer = startBridgeServer(0, {
      onStatus: vi.fn(),
      onDiagnostics: () => ({ ok: true })
    });
    await new Promise<void>((resolve) => firstServer.once("listening", resolve));
    const port = (firstServer.address() as AddressInfo).port;
    const onError = vi.fn();

    server = startBridgeServer(port, {
      onStatus: vi.fn(),
      onDiagnostics: () => ({ ok: true }),
      onError
    });

    await new Promise<void>((resolve) => server?.once("error", () => resolve()));

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "EADDRINUSE" }));
    firstServer.close();
  });
});
