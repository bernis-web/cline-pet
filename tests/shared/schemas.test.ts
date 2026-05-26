import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../src/shared/errors";
import { petPackManifestSchema, updatePetStatusSchema } from "../../src/shared/schemas";

describe("schemas", () => {
  it("accepts a valid status update", () => {
    const result = updatePetStatusSchema.parse({
      status: "working",
      task: "Implementing MCP bridge",
      message: "Updating the pet.",
      source: "cline"
    });
    expect(result.status).toBe("working");
  });

  it("rejects an invalid status update", () => {
    expect(() => updatePetStatusSchema.parse({ status: "reading" })).toThrow();
  });

  it("validates a pet pack manifest", () => {
    const manifest = petPackManifestSchema.parse({
      id: "cyber-cat",
      name: "Cyber Cat",
      version: "1.0.0",
      states: {
        idle: "idle.gif",
        thinking: "thinking.gif",
        working: "working.gif",
        "waiting-approval": "waiting-approval.gif",
        done: "done.gif",
        error: "error.gif"
      }
    });
    expect(manifest.id).toBe("cyber-cat");
  });

  it("includes INVALID_PET_PACK", () => {
    expect(ERROR_CODES.INVALID_PET_PACK).toBe("INVALID_PET_PACK");
  });
});