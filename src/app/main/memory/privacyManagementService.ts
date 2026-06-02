import { readChatHistory, type ChatHistoryTurn } from "./chatHistoryStore.js";
import { appendMemoryBlockRule, clearMemoryBlockRules, deleteMemoryBlockRule, readMemoryBlockRules } from "./memoryBlocklistStore.js";
import { getMemoryOverview, type MemoryOverview } from "./memoryManagementService.js";
import type { MemoryBlockRule } from "./memoryTypes.js";

export type RendererMemoryBlockRule = Pick<MemoryBlockRule, "id" | "text" | "kind" | "sourceMemoryId" | "createdAt">;

export type PrivacyOverview = MemoryOverview & {
  blockRules: RendererMemoryBlockRule[];
  chatHistory: ChatHistoryTurn[];
  counts: {
    memories: number;
    blockRules: number;
    chatHistoryTurns: number;
  };
};

export type PrivacyOverviewResponse =
  | { ok: true; data: PrivacyOverview }
  | { ok: false; errorCode: string; message: string };

export type PrivacyExportResponse =
  | { ok: true; data: string }
  | { ok: false; errorCode: string; message: string };

export type BlockRuleMutationResponse =
  | { ok: true }
  | {
      ok: false;
      errorCode:
        | "INVALID_BLOCK_RULE_ID"
        | "BLOCK_RULE_NOT_FOUND"
        | "INVALID_CHAT_HISTORY_TURN_ID"
        | "CHAT_HISTORY_TURN_NOT_FOUND"
        | "EMPTY_CHAT_HISTORY_USER_TEXT";
      message: string;
    };

function byCreatedAtDesc(left: RendererMemoryBlockRule, right: RendererMemoryBlockRule) {
  return (right.createdAt || "").localeCompare(left.createdAt || "");
}

function toRendererBlockRule(rule: MemoryBlockRule): RendererMemoryBlockRule {
  return {
    id: rule.id,
    text: rule.text,
    ...(rule.kind ? { kind: rule.kind } : {}),
    ...(rule.sourceMemoryId ? { sourceMemoryId: rule.sourceMemoryId } : {}),
    createdAt: rule.createdAt
  };
}

export function getPrivacyOverview(root: string): PrivacyOverview {
  const memoryOverview = getMemoryOverview(root);
  const blockRules = readMemoryBlockRules(root).map(toRendererBlockRule).sort(byCreatedAtDesc);
  const chatHistory = readChatHistory(root);
  return {
    ...memoryOverview,
    blockRules,
    chatHistory,
    counts: {
      memories: memoryOverview.memories.length,
      blockRules: blockRules.length,
      chatHistoryTurns: chatHistory.length
    }
  };
}

export function exportPrivacyDataForUser(root: string, now = new Date().toISOString()): PrivacyExportResponse {
  const overview = getPrivacyOverview(root);
  return {
    ok: true,
    data: JSON.stringify({
      exportedAt: now,
      counts: overview.counts,
      relationship: overview.relationship,
      memories: overview.memories,
      blockRules: overview.blockRules,
      chatHistory: overview.chatHistory
    }, null, 2)
  };
}

export function deleteMemoryBlockRuleForUser(root: string, id: string): BlockRuleMutationResponse {
  const normalizedId = id.trim();
  if (!normalizedId) return { ok: false, errorCode: "INVALID_BLOCK_RULE_ID", message: "不要再记规则 id 无效。" };
  return deleteMemoryBlockRule(root, normalizedId)
    ? { ok: true }
    : { ok: false, errorCode: "BLOCK_RULE_NOT_FOUND", message: "这条不要再记规则已经不存在了。" };
}

export function clearMemoryBlockRulesForUser(root: string): Extract<BlockRuleMutationResponse, { ok: true }> {
  clearMemoryBlockRules(root);
  return { ok: true };
}

export function blockChatHistoryTurnForUser(root: string, turnId: string): BlockRuleMutationResponse {
  const normalizedId = turnId.trim();
  if (!normalizedId) {
    return { ok: false, errorCode: "INVALID_CHAT_HISTORY_TURN_ID", message: "聊天历史 id 无效。" };
  }

  const turn = readChatHistory(root).find((item) => item.id === normalizedId);
  if (!turn) {
    return { ok: false, errorCode: "CHAT_HISTORY_TURN_NOT_FOUND", message: "这条聊天历史已经不存在了。" };
  }

  const text = turn.userText.trim();
  if (!text) {
    return { ok: false, errorCode: "EMPTY_CHAT_HISTORY_USER_TEXT", message: "这条记录没有可加入不要再记的用户内容。" };
  }

  appendMemoryBlockRule(root, { text });
  return { ok: true };
}