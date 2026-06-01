import type { PetStatus } from "../../shared/statuses";

export type BubbleKind = "status" | "chat" | "notice" | "diagnostics";
export type BubbleMode = "transient" | "readable" | "pinned";

export type StatusBubbleInput = {
  status: PetStatus;
  visibleStatus: PetStatus;
  baseStatus: PetStatus;
  overlayStatus: PetStatus | null;
  task?: string;
  message?: string;
  updatedAt?: string;
};

export type BubbleMessage = {
  id: string;
  kind: BubbleKind;
  text: string;
  status?: PetStatus;
  createdAt: string;
  autoHideMs: number | null;
  mode: BubbleMode;
  isLongText: boolean;
};

function timestamp(value?: string) {
  return value ?? new Date().toISOString();
}

function idFor(kind: BubbleKind, createdAt: string) {
  return `${kind}-${createdAt}`;
}

export function shouldShowStatusBubble(input: StatusBubbleInput) {
  return Boolean(input.message?.trim() || input.task?.trim());
}

export function isLongChatText(text: string) {
  const compact = text.trim();
  const latinCount = (compact.match(/[A-Za-z0-9]/g) ?? []).length;
  const cjkCount = (compact.match(/[\u3400-\u9fff]/g) ?? []).length;
  return cjkCount > 90 || latinCount > 180 || compact.length > 180;
}

export function bubbleFromStatus(input: StatusBubbleInput): BubbleMessage | null {
  if (!shouldShowStatusBubble(input)) return null;
  const createdAt = timestamp(input.updatedAt);
  return {
    id: idFor("status", createdAt),
    kind: "status",
    text: (input.message?.trim() || input.task?.trim() || "").trim(),
    status: input.visibleStatus ?? input.status,
    createdAt,
    autoHideMs: 4500,
    mode: "transient",
    isLongText: false
  };
}

export function bubbleFromChat(text: string, createdAt = new Date().toISOString()): BubbleMessage {
  return {
    id: idFor("chat", createdAt),
    kind: "chat",
    text,
    createdAt,
    autoHideMs: 5000,
    mode: "transient",
    isLongText: isLongChatText(text)
  };
}

export function bubbleFromNotice(text: string, createdAt = new Date().toISOString()): BubbleMessage {
  return {
    id: idFor("notice", createdAt),
    kind: "notice",
    text,
    createdAt,
    autoHideMs: 7000,
    mode: "transient",
    isLongText: false
  };
}

export function bubbleFromDiagnostics(text: string, createdAt = new Date().toISOString()): BubbleMessage {
  return {
    id: idFor("diagnostics", createdAt),
    kind: "diagnostics",
    text,
    createdAt,
    autoHideMs: null,
    mode: "pinned",
    isLongText: false
  };
}