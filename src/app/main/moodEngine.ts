import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";

export type MoodName = "calm" | "happy" | "attached" | "curious" | "sleepy" | "upset" | "lonely";

export type MoodState = {
  name: MoodName;
  suggestedStatus: PetStatus;
};

function hasActiveWarmth(relationship: RelationshipMemory, now: string) {
  if (!relationship.recentWarmth) return false;
  return new Date(relationship.recentWarmth.expiresAt).getTime() > new Date(now).getTime();
}

export function deriveMoodState(input: {
  now: string;
  relationship: RelationshipMemory;
  hasRecentChat: boolean;
  lastChatSentiment: "positive" | "neutral" | "negative";
  memoryHitCount: number;
  clineVisibleStatus: PetStatus;
}): MoodState {
  const hour = new Date(input.now).getUTCHours();
  const activeWarmth = hasActiveWarmth(input.relationship, input.now);

  if (input.clineVisibleStatus === "loading" || input.clineVisibleStatus === "thinking") {
    return { name: "curious", suggestedStatus: input.clineVisibleStatus };
  }

  if (!input.hasRecentChat && (hour >= 23 || hour < 6)) {
    return { name: "sleepy", suggestedStatus: hour >= 23 ? "sleepy" : "sleeping" };
  }

  if (input.lastChatSentiment === "negative") {
    if (activeWarmth) {
      return { name: "calm", suggestedStatus: "idle" };
    }
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