import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import type { PetStatus } from "../../shared/statuses.js";

export type RendererPetPack = {
  id: string;
  name: string;
  stateImages: Record<PetStatus, string>;
  variants?: Partial<Record<PetStatus, string[]>>;
};

export type RendererPrivacyOpenPayload = {
  tab: "memories" | "blocklist" | "history" | "export";
};

export type RendererDiagnosticsPayload = {
  text: string;
};

export type ChatResponse =
  | { ok: true; text: string }
  | { ok: false; errorCode: string; message: string };

export type RendererChatHistoryTurn = {
  id: string;
  userText: string;
  assistantText: string;
  createdAt: string;
  sentiment: string;
  summary?: string;
  memoryIds: string[];
};

export type ChatHistoryResponse =
  | { ok: true; data: RendererChatHistoryTurn[] }
  | { ok: false; errorCode: string; message: string };

export type ClearChatHistoryResponse =
  | { ok: true }
  | { ok: false; errorCode: string; message: string };

export type RelationshipStage = "new" | "familiar" | "close" | "trusted";

export type RendererRelationshipOverview = {
  stage: RelationshipStage;
  stageLabel: string;
  stageDescription: string;
  familiarity: number;
  affection: number;
  engagement: number;
  trust: number;
  updatedAt: string;
};

export type RendererContextMemory = {
  id: string;
  kind: "conversation-summary" | "fact" | "preference" | "project-context";
  text: string;
  tags: string[];
  weight: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoryOverview = {
  relationship: RendererRelationshipOverview;
  memories: RendererContextMemory[];
};

export type MemoryOverviewResponse =
  | { ok: true; data: MemoryOverview }
  | { ok: false; errorCode: string; message: string };

export type DeleteMemoryResponse =
  | { ok: true }
  | { ok: false; errorCode: string; message: string };

export type UpdateMemoryResponse =
  | { ok: true; data: RendererContextMemory }
  | { ok: false; errorCode: string; message: string };

export type BlockMemoryResponse =
  | { ok: true; data: { blockedCount: number } }
  | { ok: false; errorCode: string; message: string };

export type ClearMemoriesResponse = DeleteMemoryResponse;

export type ExportMemoriesResponse =
  | { ok: true; data: string }
  | { ok: false; errorCode: string; message: string };

export type RendererMemoryBlockRule = {
  id: string;
  text: string;
  kind?: RendererContextMemory["kind"];
  sourceMemoryId?: string;
  createdAt: string;
};

export type PrivacyOverview = MemoryOverview & {
  blockRules: RendererMemoryBlockRule[];
  chatHistory: RendererChatHistoryTurn[];
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
  | { ok: false; errorCode: string; message: string };

export type PresenceActivityInput = {
  userIsReading?: boolean;
};

export type PresenceActivityResponse =
  | { ok: true }
  | { ok: false; message: string };

export type HeadPatInteractionInput = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type HeadPatInteractionResponse =
  | { ok: true }
  | { ok: false; errorCode: string; message: string };

export type DeepSeekSettings = {
  configured: boolean;
  baseUrl: string;
  model: string;
  apiKeySource: "env" | "file" | "missing";
  configPath: string;
};

export type DeepSeekSettingsInput = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type DeepSeekSettingsResponse =
  | { ok: true; data: DeepSeekSettings }
  | { ok: false; errorCode: string; message: string };

export type IpcLike = {
  on(channel: "pet-status", callback: (event: unknown, payload: UpdatePetStatusInput) => void): void;
  on(channel: "pet-pack", callback: (event: unknown, payload: RendererPetPack) => void): void;
  on(channel: "chat:response", callback: (event: unknown, payload: ChatResponse) => void): void;
  on(channel: "privacy:open", callback: (event: unknown, payload: RendererPrivacyOpenPayload) => void): void;
  on(channel: "diagnostics:show", callback: (event: unknown, payload: RendererDiagnosticsPayload) => void): void;
  invoke(channel: "get-pet-pack"): Promise<RendererPetPack>;
  invoke(channel: "chat:send", payload: { text: string }): Promise<ChatResponse>;
  invoke(channel: "chat:get-history"): Promise<ChatHistoryResponse>;
  invoke(channel: "chat:clear-history"): Promise<ClearChatHistoryResponse>;
  invoke(channel: "memory:get-overview"): Promise<MemoryOverviewResponse>;
  invoke(channel: "memory:delete", payload: { id: string }): Promise<DeleteMemoryResponse>;
  invoke(channel: "memory:clear"): Promise<ClearMemoriesResponse>;
  invoke(channel: "memory:export"): Promise<ExportMemoriesResponse>;
  invoke(channel: "memory:update", payload: { id: string; text: string }): Promise<UpdateMemoryResponse>;
  invoke(channel: "memory:block", payload: { id: string }): Promise<BlockMemoryResponse>;
  invoke(channel: "privacy:get-overview"): Promise<PrivacyOverviewResponse>;
  invoke(channel: "privacy:export"): Promise<PrivacyExportResponse>;
  invoke(channel: "memory-blocklist:delete", payload: { id: string }): Promise<BlockRuleMutationResponse>;
  invoke(channel: "memory-blocklist:clear"): Promise<BlockRuleMutationResponse>;
  invoke(channel: "chat-history:block", payload: { id: string }): Promise<BlockRuleMutationResponse>;
  invoke(channel: "presence:set-activity", payload: PresenceActivityInput): Promise<PresenceActivityResponse>;
  invoke(channel: "deepseek:get-settings"): Promise<DeepSeekSettingsResponse>;
  invoke(channel: "deepseek:save-settings", payload: DeepSeekSettingsInput): Promise<DeepSeekSettingsResponse>;
  invoke(channel: "window:move-by", payload: { dx: number; dy: number }): Promise<{ ok: boolean; message?: string }>;
  invoke(channel: "interaction:head-pat", payload: HeadPatInteractionInput): Promise<HeadPatInteractionResponse>;
};

export function createRendererPetBridge(ipc: IpcLike) {
  return {
    onPetStatus(callback: (payload: UpdatePetStatusInput) => void) {
      ipc.on("pet-status", (_event, payload) => callback(payload));
    },
    onPetPack(callback: (payload: RendererPetPack) => void) {
      ipc.on("pet-pack", (_event, payload) => callback(payload));
    },
    onPrivacyOpen(callback: (payload: RendererPrivacyOpenPayload) => void) {
      ipc.on("privacy:open", (_event, payload) => callback(payload));
    },
    onDiagnostics(callback: (payload: RendererDiagnosticsPayload) => void) {
      ipc.on("diagnostics:show", (_event, payload) => callback(payload));
    },
    getPetPack() {
      return ipc.invoke("get-pet-pack");
    },
    sendChatMessage(text: string) {
      return ipc.invoke("chat:send", { text });
    },
    getChatHistory() {
      return ipc.invoke("chat:get-history");
    },
    clearChatHistory() {
      return ipc.invoke("chat:clear-history");
    },
    getMemoryOverview() {
      return ipc.invoke("memory:get-overview");
    },
    deleteMemory(id: string) {
      return ipc.invoke("memory:delete", { id });
    },
    clearMemories() {
      return ipc.invoke("memory:clear");
    },
    exportMemories() {
      return ipc.invoke("memory:export");
    },
    updateMemory(id: string, text: string) {
      return ipc.invoke("memory:update", { id, text });
    },
    blockMemory(id: string) {
      return ipc.invoke("memory:block", { id });
    },
    getPrivacyOverview() {
      return ipc.invoke("privacy:get-overview");
    },
    exportPrivacyData() {
      return ipc.invoke("privacy:export");
    },
    deleteMemoryBlockRule(id: string) {
      return ipc.invoke("memory-blocklist:delete", { id });
    },
    clearMemoryBlockRules() {
      return ipc.invoke("memory-blocklist:clear");
    },
    blockChatHistoryTurn(id: string) {
      return ipc.invoke("chat-history:block", { id });
    },
    setPresenceActivity(input: PresenceActivityInput) {
      return ipc.invoke("presence:set-activity", input);
    },
    getDeepSeekSettings() {
      return ipc.invoke("deepseek:get-settings");
    },
    saveDeepSeekSettings(input: DeepSeekSettingsInput) {
      return ipc.invoke("deepseek:save-settings", input);
    },
    movePetWindowBy(dx: number, dy: number) {
      return ipc.invoke("window:move-by", { dx, dy });
    },
    reportHeadPatInteraction(input: HeadPatInteractionInput) {
      return ipc.invoke("interaction:head-pat", input);
    },
    onChatResponse(callback: (payload: ChatResponse) => void) {
      ipc.on("chat:response", (_event, payload) => callback(payload));
    }
  };
}