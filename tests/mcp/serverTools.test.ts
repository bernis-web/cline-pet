import { describe, expect, it } from "vitest";
import { handleUpdatePetStatus } from "../../src/mcp/server";

describe("mcp tool handlers", () => {
  it("rejects invalid status", async () => {
    const result = await handleUpdatePetStatus({ status: "reading" }, async () => ({ ok: true, data: { delivered: true } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("INVALID_STATUS");
  });

  it("sends valid status through injected bridge sender", async () => {
    const result = await handleUpdatePetStatus({ status: "working", task: "test" }, async () => ({ ok: true, data: { delivered: true } }));
    expect(result.ok).toBe(true);
  });
});