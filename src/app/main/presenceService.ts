import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";
import type { MoodName } from "./moodEngine.js";
import { decidePlayfulPresence } from "./playfulPresence.js";

function relationshipStage(relationship: RelationshipMemory | undefined) {
  if (!relationship) return "new" as const;
  const average = (relationship.familiarity + relationship.affection + relationship.engagement + relationship.trust) / 4;
  if (average >= 70) return "trusted" as const;
  if (average >= 45) return "close" as const;
  if (average >= 20) return "familiar" as const;
  return "new" as const;
}

export function maybeCreatePresencePulse(input: {
  now: string;
  lastPresenceAt?: string;
  latestVisibleStatus: PetStatus;
  mood: MoodName;
  relationship?: RelationshipMemory;
  userIsReading?: boolean;
  longWorkSession?: boolean;
}): UpdatePetStatusInput | null {
  const nowMs = new Date(input.now).getTime();
  const lastPresenceMs = input.lastPresenceAt ? new Date(input.lastPresenceAt).getTime() : 0;
  const cooldownMs = 4 * 60 * 60 * 1000;

  if (input.userIsReading) {
    return null;
  }

  const stage = relationshipStage(input.relationship);

  if (input.longWorkSession) {
    const longWorkMessage = stage === "trusted"
      ? "先喝口水，我会继续在这陪你。"
      : stage === "close"
        ? "先喝口水吧，我会在旁边等你。"
        : "要不要喝口水？我会乖乖等你。";

    return {
      status: "message",
      visibleStatus: "message",
      baseStatus: "message",
      overlayStatus: null,
      task: "",
      message: longWorkMessage,
      source: "presence",
      updatedAt: input.now
    };
  }

  if (input.relationship) {
    const playful = decidePlayfulPresence({
      now: input.now,
      relationship: input.relationship,
      latestVisibleStatus: input.latestVisibleStatus,
      userIsReading: input.userIsReading,
      longWorkSession: input.longWorkSession,
      lastPresenceAt: input.lastPresenceAt
    });

    if (playful) {
      return {
        status: playful.status,
        visibleStatus: playful.status,
        baseStatus: playful.status,
        overlayStatus: null,
        task: "",
        message: playful.message,
        source: "presence",
        updatedAt: input.now
      };
    }
  }

  if ((input.latestVisibleStatus === "loading" || input.latestVisibleStatus === "thinking") && !input.longWorkSession) {
    return null;
  }

  if (lastPresenceMs && nowMs - lastPresenceMs < cooldownMs) {
    return null;
  }

  if (input.mood === "lonely") {
    const lonelyMessage = stage === "trusted"
      ? "我会在这安静陪着你，想说话就叫我。"
      : "我会安静陪在你旁边。";

    return {
      status: "message",
      visibleStatus: "message",
      baseStatus: "message",
      overlayStatus: null,
      task: "",
      message: lonelyMessage,
      source: "presence",
      updatedAt: input.now
    };
  }

  return null;
}