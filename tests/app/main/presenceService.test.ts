import { describe, expect, it } from "vitest";
import { maybeCreatePresencePulse } from "../../../src/app/main/presenceService";

describe("presence service", () => {
  it("stays quiet during cooldown", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-05-29T20:00:00.000Z",
      lastPresenceAt: "2026-05-29T19:45:00.000Z",
      latestVisibleStatus: "loading",
      mood: "attached"
    });

    expect(pulse).toBeNull();
  });

  it("emits a gentle message after a long quiet period", () => {
    const pulse = maybeCreatePresencePulse({
      now: "2026-05-29T21:00:00.000Z",
      lastPresenceAt: "2026-05-29T10:00:00.000Z",
      latestVisibleStatus: "idle",
      mood: "lonely"
    });

    expect(pulse).toEqual(expect.objectContaining({ status: "message", message: expect.stringContaining("陪") }));
  });
});