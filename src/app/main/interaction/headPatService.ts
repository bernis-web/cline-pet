import { saveRelationshipMemory } from "../memory/relationshipStore.js";
import type { RelationshipMemory } from "../memory/memoryTypes.js";

export type HeadPatInteractionInput = {
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
};

export type HeadPatInteractionResult =
  | { ok: true; relationship: RelationshipMemory }
  | { ok: false; errorCode: "HEAD_PAT_TOO_SHORT" | "HEAD_PAT_INVALID"; message: string };

const MIN_EFFECTIVE_HEAD_PAT_MS = 600;
const MAX_REASONABLE_HEAD_PAT_MS = 30_000;
const WARMTH_TTL_MS = 30 * 60 * 1000;
const HEAD_PAT_EVENT_TEXT = "今天被轻轻摸了摸头";

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasHeadPatEventToday(relationship: RelationshipMemory, endedAt: string) {
  const day = endedAt.slice(0, 10);
  return relationship.recentEvents.some((event) => event.text === HEAD_PAT_EVENT_TEXT && event.createdAt.slice(0, 10) === day);
}

export function recordHeadPatInteraction(root: string, input: HeadPatInteractionInput): HeadPatInteractionResult {
  const durationMs = Number(input.durationMs ?? 0);
  if (!Number.isFinite(durationMs) || durationMs < MIN_EFFECTIVE_HEAD_PAT_MS) {
    return { ok: false, errorCode: "HEAD_PAT_TOO_SHORT", message: "head pat duration is too short" };
  }
  if (durationMs > MAX_REASONABLE_HEAD_PAT_MS) {
    return { ok: false, errorCode: "HEAD_PAT_INVALID", message: "head pat duration is invalid" };
  }

  const endedAtDate = parseDate(input.endedAt) ?? new Date();
  const endedAt = endedAtDate.toISOString();
  const expiresAt = new Date(endedAtDate.getTime() + WARMTH_TTL_MS).toISOString();

  const relationship = saveRelationshipMemory(root, (current) => {
    const recentEvents = hasHeadPatEventToday(current, endedAt)
      ? current.recentEvents
      : [{ text: HEAD_PAT_EVENT_TEXT, createdAt: endedAt, weight: 1 }, ...current.recentEvents].slice(0, 20);

    return {
      ...current,
      lastInteractionAt: endedAt,
      lastHeadPatAt: endedAt,
      recentWarmth: {
        source: "head-pat",
        intensity: "soft",
        updatedAt: endedAt,
        expiresAt
      },
      recentEvents
    };
  });

  return { ok: true, relationship };
}

export function hasActiveWarmth(relationship: RelationshipMemory, now: string) {
  if (!relationship.recentWarmth) return false;
  return new Date(relationship.recentWarmth.expiresAt).getTime() > new Date(now).getTime();
}