export const PET_STATUSES = [
  "idle",
  "thinking",
  "working",
  "waiting-approval",
  "done",
  "error"
] as const;

export type PetStatus = (typeof PET_STATUSES)[number];

export const STATUS_LABELS: Record<PetStatus, string> = {
  idle: "idle（空闲）",
  thinking: "thinking（思考中）",
  working: "working（工作中）",
  "waiting-approval": "waiting-approval（等待批准）",
  done: "done（完成）",
  error: "error（错误）"
};

export function isPetStatus(value: unknown): value is PetStatus {
  return typeof value === "string" && PET_STATUSES.includes(value as PetStatus);
}

export function toStatusLabel(status: PetStatus): string {
  return STATUS_LABELS[status];
}