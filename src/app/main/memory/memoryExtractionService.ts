import { randomUUID } from "node:crypto";
import type { DeepSeekConfig } from "../config.js";
import { requestDeepSeekChat, type DeepSeekChatResult, type DeepSeekMessage } from "../deepseekClient.js";
import { readContextMemories, writeContextMemories } from "./contextStore.js";
import { mergeContextMemory } from "./memoryDeduplication.js";
import type { ContextMemoryItem } from "./memoryTypes.js";

export type MemoryExtractionSentiment = "positive" | "neutral" | "negative" | "tired" | "stressed" | "focused";
export type RelationshipEventKind = "chat" | "support" | "work-session" | "stress" | "none";

export type MemoryExtractionResult = {
  shouldRemember: boolean;
  conversationSummary: string | null;
  sentiment: MemoryExtractionSentiment;
  facts: string[];
  preferences: string[];
  projectContext: string[];
  careSignals: string[];
  relationshipEvent: RelationshipEventKind;
};

export type MemoryExtractionParseResult =
  | { ok: true; data: MemoryExtractionResult }
  | { ok: false; errorCode: "MEMORY_EXTRACTION_BAD_RESPONSE" };

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

function sentiment(value: unknown): MemoryExtractionSentiment {
  return ["positive", "neutral", "negative", "tired", "stressed", "focused"].includes(String(value)) ? value as MemoryExtractionSentiment : "neutral";
}

function relationshipEvent(value: unknown): RelationshipEventKind {
  return ["chat", "support", "work-session", "stress", "none"].includes(String(value)) ? value as RelationshipEventKind : "none";
}

export function parseMemoryExtractionJson(text: string): MemoryExtractionParseResult {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    return {
      ok: true,
      data: {
        shouldRemember: Boolean(value.shouldRemember),
        conversationSummary: typeof value.conversationSummary === "string" && value.conversationSummary.trim() ? value.conversationSummary.trim() : null,
        sentiment: sentiment(value.sentiment),
        facts: stringArray(value.facts),
        preferences: stringArray(value.preferences),
        projectContext: stringArray(value.projectContext),
        careSignals: stringArray(value.careSignals),
        relationshipEvent: relationshipEvent(value.relationshipEvent)
      }
    };
  } catch {
    return { ok: false, errorCode: "MEMORY_EXTRACTION_BAD_RESPONSE" };
  }
}

function messages(input: { userText: string; assistantText: string; relationshipSummary: string; relevantMemorySummaries: string[]; recentChatSummaries: string[] }): DeepSeekMessage[] {
  return [
    {
      role: "system",
      content: "你是卡卡的本地记忆整理器。只基于用户聊天内容提炼记忆，不要声称读取文件、代码、屏幕或终端。只输出严格 JSON。"
    },
    {
      role: "user",
      content: JSON.stringify({
        relationshipSummary: input.relationshipSummary,
        relevantMemorySummaries: input.relevantMemorySummaries.slice(0, 3),
        recentChatSummaries: input.recentChatSummaries.slice(0, 5),
        currentTurn: { userText: input.userText, assistantText: input.assistantText },
        outputShape: {
          shouldRemember: true,
          conversationSummary: "string|null",
          sentiment: "positive|neutral|negative|tired|stressed|focused",
          facts: ["string"],
          preferences: ["string"],
          projectContext: ["string"],
          careSignals: ["string"],
          relationshipEvent: "chat|support|work-session|stress|none"
        }
      })
    }
  ];
}

function item(kind: ContextMemoryItem["kind"], text: string, tags: string[], weight: number, now: string): ContextMemoryItem {
  return { id: randomUUID(), kind, text, tags, weight, createdAt: now, updatedAt: now };
}

function toItems(result: MemoryExtractionResult, now: string): ContextMemoryItem[] {
  if (!result.shouldRemember) return [];
  const base = ["chat", "deepseek-extracted", `sentiment:${result.sentiment}`];
  return [
    ...result.facts.map((text) => item("fact", text, [...base, "fact"], 60, now)),
    ...result.preferences.map((text) => item("preference", text, [...base, "preference"], 80, now)),
    ...result.projectContext.map((text) => item("project-context", text, [...base, "project"], 65, now)),
    ...result.careSignals.map((text) => item("conversation-summary", text, [...base, "care"], 60, now)),
    ...(result.conversationSummary ? [item("conversation-summary", result.conversationSummary, [...base, "summary"], 40, now)] : [])
  ];
}

export async function extractAndStoreMemories(input: {
  root: string;
  config: DeepSeekConfig;
  turn: { userText: string; assistantText: string; createdAt: string };
  relationshipSummary: string;
  relevantMemorySummaries: string[];
  recentChatSummaries: string[];
  requester?: (input: { config: DeepSeekConfig; messages: DeepSeekMessage[]; timeoutMs: number }) => Promise<DeepSeekChatResult>;
}) {
  const requester = input.requester ?? requestDeepSeekChat;
  const response = await requester({
    config: input.config,
    messages: messages({
      userText: input.turn.userText,
      assistantText: input.turn.assistantText,
      relationshipSummary: input.relationshipSummary,
      relevantMemorySummaries: input.relevantMemorySummaries,
      recentChatSummaries: input.recentChatSummaries
    }),
    timeoutMs: 15000
  });
  if (!response.ok) return response;
  const parsed = parseMemoryExtractionJson(response.data.text);
  if (!parsed.ok) return parsed;
  const nextItems = toItems(parsed.data, input.turn.createdAt);
  const merged = nextItems.reduce((items, candidate) => mergeContextMemory(items, candidate), readContextMemories(input.root));
  writeContextMemories(input.root, merged);
  return { ok: true as const, data: { extraction: parsed.data, memoryIds: nextItems.map((memory) => memory.id) } };
}