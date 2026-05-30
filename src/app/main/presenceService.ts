import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import type { PetStatus } from "../../shared/statuses.js";
import type { MoodName } from "./moodEngine.js";

export function maybeCreatePresencePulse(input: {
  now: string;
  lastPresenceAt?: string;
  latestVisibleStatus: PetStatus;
  mood: MoodName;
}): UpdatePetStatusInput | null {
  const nowMs = new Date(input.now).getTime();
  const lastPresenceMs = input.lastPresenceAt ? new Date(input.lastPresenceAt).getTime() : 0;
  const cooldownMs = 4 * 60 * 60 * 1000;

  if (input.latestVisibleStatus === "loading" || input.latestVisibleStatus === "thinking") {
    return null;
  }

  if (lastPresenceMs && nowMs - lastPresenceMs < cooldownMs) {
    return null;
  }

  if (input.mood === "lonely") {
    return {
      status: "message",
      visibleStatus: "message",
      baseStatus: "message",
      overlayStatus: null,
      task: "",
      message: "我会安静陪在你旁边。",
      source: "presence",
      updatedAt: input.now
    };
  }

  return null;
}