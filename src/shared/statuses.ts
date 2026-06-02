export const PET_STATUSES = [
  "idle",
  "happy",
  "sleepy",
  "thinking",
  "angry",
  "not-found",
  "message",
  "sleeping",
  "head-pat",
  "dragging",
  "loading",
  "signal-weak"
] as const;

export const PET_VISIBLE_STATUSES = PET_STATUSES;

export const BASE_PET_STATUSES = [
  "idle",
  "happy",
  "sleepy",
  "thinking",
  "not-found",
  "message",
  "sleeping",
  "loading",
  "signal-weak"
] as const;

export const OVERLAY_PET_STATUSES = ["angry", "head-pat", "dragging"] as const;

export const LEGACY_PET_STATUSES = [
  "idle",
  "thinking",
  "working",
  "waiting-approval",
  "done",
  "error"
] as const;

export type PetStatus = (typeof PET_STATUSES)[number];
export type PetVisibleStatus = PetStatus;
export type PetBaseStatus = (typeof BASE_PET_STATUSES)[number];
export type PetOverlayStatus = (typeof OVERLAY_PET_STATUSES)[number];
export type LegacyPetStatus = (typeof LEGACY_PET_STATUSES)[number];
export type PetStatusInput = PetStatus | LegacyPetStatus;
export type PetStatusLayer = "base" | "overlay";

export const PET_STATUS_ALIASES: Record<LegacyPetStatus, PetStatus> = {
  idle: "idle",
  thinking: "thinking",
  working: "loading",
  "waiting-approval": "message",
  done: "happy",
  error: "not-found"
};

export const STATUS_LABELS: Record<PetStatus, string> = {
  idle: "idle（待机）",
  happy: "happy（开心）",
  sleepy: "sleepy（困困）",
  thinking: "thinking（思考）",
  angry: "angry（炸毛）",
  "not-found": "not-found（装死 404）",
  message: "message（收到消息）",
  sleeping: "sleeping（睡觉）",
  "head-pat": "head-pat（摸头反应）",
  dragging: "dragging（拖拽反应）",
  loading: "loading（加载中）",
  "signal-weak": "signal-weak（信号弱）"
};

export type NormalizedPetStatus = {
  status: PetStatus;
  normalizedFrom?: LegacyPetStatus;
};

export function isPetStatus(value: unknown): value is PetStatus {
  return typeof value === "string" && PET_STATUSES.includes(value as PetStatus);
}

export function isLegacyPetStatus(value: unknown): value is LegacyPetStatus {
  return typeof value === "string" && LEGACY_PET_STATUSES.includes(value as LegacyPetStatus);
}

export function isPetStatusInput(value: unknown): value is PetStatusInput {
  return isPetStatus(value) || isLegacyPetStatus(value);
}

export function normalizePetStatus(value: unknown): NormalizedPetStatus | null {
  if (isPetStatus(value)) return { status: value };
  if (isLegacyPetStatus(value)) return { status: PET_STATUS_ALIASES[value], normalizedFrom: value };
  return null;
}

export function isPetBaseStatus(status: PetStatus): status is PetBaseStatus {
  return BASE_PET_STATUSES.includes(status as PetBaseStatus);
}

export function isPetOverlayStatus(status: PetStatus): status is PetOverlayStatus {
  return OVERLAY_PET_STATUSES.includes(status as PetOverlayStatus);
}

export function statusLayerFor(status: PetStatus): PetStatusLayer {
  return isPetOverlayStatus(status) ? "overlay" : "base";
}

export function toStatusLabel(status: PetStatus): string {
  return STATUS_LABELS[status];
}
