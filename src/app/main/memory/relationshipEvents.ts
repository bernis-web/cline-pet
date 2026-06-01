import { saveRelationshipMemory } from "./relationshipStore.js";
import type { RelationshipMemory } from "./memoryTypes.js";
import type { MemoryExtractionSentiment, RelationshipEventKind } from "./memoryExtractionService.js";

function eventText(kind: RelationshipEventKind, sentiment: MemoryExtractionSentiment) {
  if (kind === "work-session" || sentiment === "focused") return "今天和用户一起专注了一会儿";
  if (kind === "support" || sentiment === "tired" || sentiment === "stressed") return "今天轻轻陪用户缓了一会儿";
  if (kind === "stress") return "今天用户有点压力，卡卡要更温柔";
  return "今天和用户聊了聊天";
}

function hasEventToday(relationship: RelationshipMemory, text: string, now: string) {
  const day = now.slice(0, 10);
  return relationship.recentEvents.some((event) => event.text === text && event.createdAt.slice(0, 10) === day);
}

export function applyChatRelationshipEvent(root: string, input: {
  now: string;
  sentiment: MemoryExtractionSentiment;
  relationshipEvent: RelationshipEventKind;
}) {
  return saveRelationshipMemory(root, (current) => {
    const text = eventText(input.relationshipEvent, input.sentiment);
    const repeatedToday = hasEventToday(current, text, input.now);
    const normalChat = repeatedToday ? 0 : 1;
    const supportive = !repeatedToday && (["support", "stress"].includes(input.relationshipEvent) || ["tired", "stressed"].includes(input.sentiment));
    const work = !repeatedToday && (input.relationshipEvent === "work-session" || input.sentiment === "focused");
    const recentEvents = repeatedToday
      ? current.recentEvents
      : [{ text, createdAt: input.now, weight: work ? 2 : 1 }, ...current.recentEvents].slice(0, 20);

    return {
      ...current,
      familiarity: current.familiarity + normalChat,
      affection: current.affection + (supportive ? 1 : 0),
      engagement: current.engagement + (work ? 2 : normalChat),
      trust: current.trust + (supportive ? 1 : 0),
      lastInteractionAt: input.now,
      recentEvents
    };
  });
}