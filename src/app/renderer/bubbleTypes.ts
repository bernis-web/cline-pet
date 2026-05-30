import type { PetStatus } from "../../shared/statuses";

export type BubbleKind = "status" | "chat" | "notice" | "diagnostics";

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

export function bubbleFromStatus(input: StatusBubbleInput): BubbleMessage | null {
  if (!shouldShowStatusBubble(input)) return null;
  const createdAt = timestamp(input.updatedAt);
  return {
    id: idFor("status", createdAt),
    kind: "status",
    text: (input.message?.trim() || input.task?.trim() || "").trim(),
    status: input.visibleStatus ?? input.status,
    createdAt,
    autoHideMs: 4500
  };
}

export function bubbleFromChat(text: string, createdAt = new Date().toISOString()): BubbleMessage {
  return {
    id: idFor("chat", createdAt),
    kind: "chat",
    text,
    createdAt,
    autoHideMs: 9000
  };
}

export function bubbleFromNotice(text: string, createdAt = new Date().toISOString()): BubbleMessage {
  return {
    id: idFor("notice", createdAt),
    kind: "notice",
    text,
    createdAt,
    autoHideMs: 7000
  };
}

export function bubbleFromDiagnostics(text: string, createdAt = new Date().toISOString()): BubbleMessage {
  return {
    id: idFor("diagnostics", createdAt),
    kind: "diagnostics",
    text,
    createdAt,
    autoHideMs: null
  };
}