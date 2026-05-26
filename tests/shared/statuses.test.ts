import { describe, expect, it } from "vitest";
import { isPetStatus, PET_STATUSES, toStatusLabel } from "../../src/shared/statuses";

describe("pet statuses", () => {
  it("contains the six MVP states", () => {
    expect(PET_STATUSES).toEqual([
      "idle",
      "thinking",
      "working",
      "waiting-approval",
      "done",
      "error"
    ]);
  });

  it("validates status strings", () => {
    expect(isPetStatus("working")).toBe(true);
    expect(isPetStatus("reading")).toBe(false);
  });

  it("returns English plus Chinese labels", () => {
    expect(toStatusLabel("waiting-approval")).toBe("waiting-approval（等待批准）");
  });
});