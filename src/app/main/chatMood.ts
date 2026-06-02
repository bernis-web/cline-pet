import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";
import { deriveMoodState, type ChatSentiment } from "./moodEngine.js";

export function createChatMoodStatus(input: {
  now: string;
  relationship: RelationshipMemory;
  latestVisibleStatus: PetStatus;
  sentiment?: ChatSentiment;
  memoryHitCount?: number;
}): UpdatePetStatusInput {
  const mood = deriveMoodState({
    now: input.now,
    relationship: input.relationship,
    hasRecentChat: true,
    lastChatSentiment: input.sentiment ?? "positive",
    memoryHitCount: input.memoryHitCount ?? 0,
    clineVisibleStatus: input.latestVisibleStatus
  });

  return {
    status: mood.suggestedStatus,
    visibleStatus: mood.suggestedStatus,
    baseStatus: mood.suggestedStatus,
    overlayStatus: null,
    task: "",
    source: "chat",
    updatedAt: input.now
  };
}