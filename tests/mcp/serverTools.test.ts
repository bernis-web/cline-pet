import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { handleUpdatePetStatus, isCliEntryPoint, updatePetStatusInputSchema } from "../../src/mcp/server";

describe("mcp tool handlers", () => {
  it("rejects invalid status", async () => {
    const result = await handleUpdatePetStatus({ status: "reading" }, async () => ({ ok: true, data: { delivered: true } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("INVALID_STATUS");
  });

  it("sends normalized legacy status through injected bridge sender", async () => {
    const result = await handleUpdatePetStatus({ status: "working", task: "test" }, async (payload) => {
      expect(payload.status).toBe("loading");
      expect(payload.normalizedFrom).toBe("working");
      return { ok: true, data: { delivered: true } };
    });
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        delivered: true,
        status: "loading",
        visibleStatus: "loading",
        baseStatus: "loading",
        overlayStatus: null,
        normalizedFrom: "working"
      })
    });
  });

  it("publishes a 12-state tool input schema", () => {
    expect(updatePetStatusInputSchema.properties.status.enum).toContain("signal-weak");
    expect(updatePetStatusInputSchema.properties.status.enum).toContain("working");
    expect(updatePetStatusInputSchema.properties.layer.enum).toEqual(["base", "overlay"]);
  });

  it("detects tsx CLI execution from a platform file URL", () => {
    const scriptPath = resolve("src/mcp/server.ts");

    expect(isCliEntryPoint(pathToFileURL(scriptPath).href, scriptPath)).toBe(true);
  });
});
