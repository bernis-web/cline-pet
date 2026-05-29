import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";

export type MoodName = "calm" | "happy" | "attached" | "curious" | "sleepy" | "upset" | "lonely";

export type MoodState = {
  name: MoodName;
  suggestedStatus: PetStatus;
};

export function deriveMoodState(input: {
  now: string;
  relationship: RelationshipMemory;
  hasRecentChat: boolean;
  lastChatSentiment: "positive" | "neutral" | "negative";
  memoryHitCount: number;
  clineVisibleStatus: PetStatus;
}): MoodState {
  const hour = new Date(input.now).getUTCHours();

  if (input.clineVisibleStatus === "loading" || input.clineVisibleStatus === "thinking") {
    return { name: "curious", suggestedStatus: input.clineVisibleStatus };
  }

  if (!input.hasRecentChat && (hour >= 23 || hour < 6)) {
    return { name: "sleepy", suggestedStatus: hour >= 23 ? "sleepy" : "sleeping" };
  }

  if (input.lastChatSentiment === "negative") {
    return { name: "upset", suggestedStatus: "angry" };
  }

  if (input.lastChatSentiment === "positive" && input.relationship.affection >= 70) {
    return { name: "happy", suggestedStatus: "happy" };
  }

  if (input.memoryHitCount >= 2 && input.relationship.affection >= 50) {
    return { name: "attached", suggestedStatus: "head-pat" };
  }

  return { name: "calm", suggestedStatus: "idle" };
}