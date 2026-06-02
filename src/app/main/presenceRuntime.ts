import type { PetStatus } from "../../shared/statuses.js";

export const LONG_WORK_SESSION_MS = 90 * 60 * 1000;

export type PresenceRuntimeState = {
  userIsReading: boolean;
  workSessionStartedAt?: string;
};

export type PresenceActivityResponse =
  | { ok: true }
  | { ok: false; message: string };

export type PresenceActivityUpdate = {
  state: PresenceRuntimeState;
  response: PresenceActivityResponse;
};

function isWorkSessionStatus(status: PetStatus) {
  return status === "loading" || status === "thinking";
}

function timestampMs(value?: string) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function applyPresenceActivityInput(state: PresenceRuntimeState, input: unknown): PresenceActivityUpdate {
  const userIsReading = (input as { userIsReading?: unknown } | null | undefined)?.userIsReading;
  if (typeof userIsReading !== "boolean") {
    return { state, response: { ok: false, message: "userIsReading must be boolean" } };
  }

  return { state: { ...state, userIsReading }, response: { ok: true } };
}

export function updateWorkSession(state: PresenceRuntimeState, input: { visibleStatus: PetStatus; now: string }): PresenceRuntimeState {
  if (isWorkSessionStatus(input.visibleStatus)) {
    return state.workSessionStartedAt ? state : { ...state, workSessionStartedAt: input.now };
  }

  return { userIsReading: state.userIsReading };
}

export function hasLongWorkSession(state: PresenceRuntimeState, input: { now: string; thresholdMs?: number }) {
  const startedAt = timestampMs(state.workSessionStartedAt);
  const now = timestampMs(input.now);
  const thresholdMs = input.thresholdMs ?? LONG_WORK_SESSION_MS;
  if (startedAt === null || now === null) return false;
  return now - startedAt >= thresholdMs;
}