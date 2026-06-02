import { describe, expect, it } from "vitest";
import {
  LONG_WORK_SESSION_MS,
  applyPresenceActivityInput,
  hasLongWorkSession,
  updateWorkSession,
  type PresenceRuntimeState
} from "../../../src/app/main/presenceRuntime";

describe("presenceRuntime", () => {
  it("accepts explicit renderer reading activity and rejects malformed payloads", () => {
    const initial: PresenceRuntimeState = { userIsReading: false };

    const enabled = applyPresenceActivityInput(initial, { userIsReading: true });
    expect(enabled.response).toEqual({ ok: true });
    expect(enabled.state.userIsReading).toBe(true);

    const disabled = applyPresenceActivityInput(enabled.state, { userIsReading: false });
    expect(disabled.response).toEqual({ ok: true });
    expect(disabled.state.userIsReading).toBe(false);

    const rejected = applyPresenceActivityInput(disabled.state, { userIsReading: "yes" });
    expect(rejected.response).toEqual({ ok: false, message: "userIsReading must be boolean" });
    expect(rejected.state).toEqual(disabled.state);
  });

  it("tracks continuous loading and thinking as one work session", () => {
    let state: PresenceRuntimeState = { userIsReading: false };

    state = updateWorkSession(state, {
      visibleStatus: "loading",
      now: "2026-06-01T00:00:00.000Z"
    });
    expect(state.workSessionStartedAt).toBe("2026-06-01T00:00:00.000Z");

    state = updateWorkSession(state, {
      visibleStatus: "thinking",
      now: "2026-06-01T00:45:00.000Z"
    });
    expect(state.workSessionStartedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("marks a work session long only after the 90 minute threshold", () => {
    const state: PresenceRuntimeState = {
      userIsReading: false,
      workSessionStartedAt: "2026-06-01T00:00:00.000Z"
    };

    expect(hasLongWorkSession(state, { now: "2026-06-01T01:29:59.000Z" })).toBe(false);
    expect(hasLongWorkSession(state, { now: "2026-06-01T01:30:00.000Z" })).toBe(true);
    expect(LONG_WORK_SESSION_MS).toBe(90 * 60 * 1000);
  });

  it("resets the work session when visible status leaves loading and thinking", () => {
    const state = updateWorkSession({
      userIsReading: false,
      workSessionStartedAt: "2026-06-01T00:00:00.000Z"
    }, {
      visibleStatus: "idle",
      now: "2026-06-01T01:00:00.000Z"
    });

    expect(state).toEqual({ userIsReading: false });
    expect(hasLongWorkSession(state, { now: "2026-06-01T03:00:00.000Z" })).toBe(false);
  });
});