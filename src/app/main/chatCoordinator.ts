import type { DeepSeekConfig } from "./config.js";
import type { DeepSeekChatResult, DeepSeekMessage } from "./deepseekClient.js";
import { createChatMoodStatus } from "./chatMood.js";
import { createChatReply, type ChatReplyResult } from "./chatService.js";
import { appendChatHistoryTurn } from "./memory/chatHistoryStore.js";
import { readChatHistory } from "./memory/chatHistoryStore.js";
import { readContextMemories } from "./memory/contextStore.js";
import { extractAndStoreMemories } from "./memory/memoryExtractionService.js";
import type { MemoryExtractionSentiment } from "./memory/memoryExtractionService.js";
import { buildMemoryPromptContext } from "./memory/memoryService.js";
import { loadProfileMemory } from "./memory/profileStore.js";
import { applyChatRelationshipEvent } from "./memory/relationshipEvents.js";
import { loadRelationshipMemory } from "./memory/relationshipStore.js";
import { searchContextMemories } from "./memory/retrieval.js";
import type { PetStatus } from "../../shared/statuses.js";

export type KakaChatTurnResult =
  | { ok: true; text: string; moodStatus: ReturnType<typeof createChatMoodStatus> }
  | { ok: false; errorCode: string; message: string };

export async function runKakaChatTurn(input: {
  root: string;
  config: DeepSeekConfig;
  text: string;
  now: string;
  latestVisibleStatus: PetStatus;
  chatRequester?: (input: { config: DeepSeekConfig; messages: DeepSeekMessage[]; timeoutMs: number }) => Promise<DeepSeekChatResult>;
  extractionRequester?: (input: { config: DeepSeekConfig; messages: DeepSeekMessage[]; timeoutMs: number }) => Promise<DeepSeekChatResult>;
}): Promise<KakaChatTurnResult> {
  const profile = loadProfileMemory(input.root);
  const relationship = loadRelationshipMemory(input.root);
  const memories = readContextMemories(input.root);
  const relevantMemories = searchContextMemories(memories, input.text, 3);
  const memoryContext = buildMemoryPromptContext({ profile, relationship, memories: relevantMemories });

  const reply: ChatReplyResult = await createChatReply({
    text: input.text,
    config: input.config,
    memoryContext,
    requester: input.chatRequester
  });
  if (!reply.ok) return { ok: false, errorCode: reply.errorCode, message: reply.message };

  appendChatHistoryTurn(input.root, {
    userText: input.text.trim(),
    assistantText: reply.data.text,
    createdAt: input.now,
    sentiment: "neutral",
    memoryIds: []
  });

  const extraction = await extractAndStoreMemories({
    root: input.root,
    config: input.config,
    turn: { userText: input.text.trim(), assistantText: reply.data.text, createdAt: input.now },
    relationshipSummary: memoryContext.relationshipSummary ?? "",
    relevantMemorySummaries: relevantMemories.map((memory) => memory.text),
    recentChatSummaries: readChatHistory(input.root, { limit: 5 }).map((turn) => turn.summary ?? turn.assistantText),
    requester: input.extractionRequester
  });

  const sentiment: MemoryExtractionSentiment = extraction.ok ? extraction.data.extraction.sentiment : "positive";
  const relationshipEvent = extraction.ok ? extraction.data.extraction.relationshipEvent : "chat";
  const nextRelationship = applyChatRelationshipEvent(input.root, { now: input.now, sentiment, relationshipEvent });

  return {
    ok: true,
    text: reply.data.text,
    moodStatus: createChatMoodStatus({
      now: input.now,
      relationship: nextRelationship,
      latestVisibleStatus: input.latestVisibleStatus,
      sentiment,
      memoryHitCount: relevantMemories.length
    })
  };
}