import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { getPaths } from "../../../shared/paths.js";

export type ChatHistorySentiment = "positive" | "neutral" | "negative" | "tired" | "stressed" | "focused";

export type ChatHistoryTurn = {
  id: string;
  userText: string;
  assistantText: string;
  createdAt: string;
  sentiment: ChatHistorySentiment;
  summary?: string;
  memoryIds: string[];
};

export type NewChatHistoryTurn = Omit<ChatHistoryTurn, "id"> & { id?: string };

function chatHistoryFile(root: string) {
  return getPaths({ APPDATA: root } as NodeJS.ProcessEnv).chatHistoryFile;
}

function parseTurn(line: string): ChatHistoryTurn | null {
  try {
    const value = JSON.parse(line) as ChatHistoryTurn;
    if (!value.id || !value.userText || !value.assistantText || !value.createdAt) return null;
    return { ...value, memoryIds: Array.isArray(value.memoryIds) ? value.memoryIds : [] };
  } catch {
    return null;
  }
}

export function readChatHistory(root: string, options: { limit?: number } = {}): ChatHistoryTurn[] {
  const file = chatHistoryFile(root);
  if (!existsSync(file)) return [];
  const turns = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseTurn)
    .filter((turn): turn is ChatHistoryTurn => Boolean(turn))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return typeof options.limit === "number" ? turns.slice(0, options.limit) : turns;
}

export function appendChatHistoryTurn(root: string, input: NewChatHistoryTurn, options: { maxTurns?: number } = {}): ChatHistoryTurn {
  const file = chatHistoryFile(root);
  const turn: ChatHistoryTurn = {
    id: input.id ?? randomUUID(),
    userText: input.userText,
    assistantText: input.assistantText,
    createdAt: input.createdAt,
    sentiment: input.sentiment,
    ...(input.summary ? { summary: input.summary } : {}),
    memoryIds: input.memoryIds ?? []
  };
  const maxTurns = options.maxTurns ?? 200;
  const oldestFirst = [...readChatHistory(root), turn]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-maxTurns);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${oldestFirst.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
  return turn;
}

export function clearChatHistory(root: string) {
  const file = chatHistoryFile(root);
  if (existsSync(file)) rmSync(file, { force: true });
}