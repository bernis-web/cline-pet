import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";

export type PlayfulPresenceDecision = {
  status: Extract<PetStatus, "happy" | "message" | "sleepy">;
  message: string;
};

const PRESENCE_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const IDLE_CHECKIN_MS = 6 * 60 * 60 * 1000;

function timestampMs(value?: string) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function hasActiveWindow(until: string | undefined, now: string) {
  const untilMs = timestampMs(until);
  const nowMs = timestampMs(now);
  if (untilMs === null || nowMs === null) return false;
  return untilMs > nowMs;
}

function hasActiveWarmth(relationship: RelationshipMemory, now: string) {
  const expiresAt = relationship.recentWarmth?.expiresAt;
  return hasActiveWindow(expiresAt, now);
}

function isNightHour(now: string) {
  const hour = new Date(now).getUTCHours();
  return hour >= 23 || hour < 6;
}

function isBusyStatus(status: PetStatus) {
  return status === "loading" || status === "thinking" || status === "message";
}

function inCooldown(lastPresenceAt: string | undefined, now: string) {
  const lastMs = timestampMs(lastPresenceAt);
  const nowMs = timestampMs(now);
  if (lastMs === null || nowMs === null) return false;
  return nowMs - lastMs < PRESENCE_COOLDOWN_MS;
}

function hasBeenIdleLongEnough(lastInteractionAt: string | undefined, now: string) {
  const lastMs = timestampMs(lastInteractionAt);
  const nowMs = timestampMs(now);
  if (lastMs === null || nowMs === null) return false;
  return nowMs - lastMs >= IDLE_CHECKIN_MS;
}

export function decidePlayfulPresence(input: {
  now: string;
  relationship: RelationshipMemory;
  latestVisibleStatus: PetStatus;
  userIsReading?: boolean;
  longWorkSession?: boolean;
  lastPresenceAt?: string;
}): PlayfulPresenceDecision | null {
  if (input.userIsReading || input.longWorkSession) {
    return null;
  }

  if (isBusyStatus(input.latestVisibleStatus)) {
    return null;
  }

  if (inCooldown(input.lastPresenceAt, input.now)) {
    return null;
  }

  const activeChat = hasActiveWindow(input.relationship.playfulChatUntil, input.now);
  const activeAttached = hasActiveWindow(input.relationship.playfulAttachedUntil, input.now);
  const activeChatWarmth = input.relationship.recentWarmth?.source === "chat" && hasActiveWarmth(input.relationship, input.now);

  if (isNightHour(input.now)) {
    if (activeChat || activeAttached || activeChatWarmth) {
      return { status: "sleepy", message: "我还在喔，晚一点要不要一起休息？" };
    }
    return null;
  }

  if (activeAttached) {
    return { status: "message", message: "要不要再摸摸我呀？我会乖一点。" };
  }

  if (activeChatWarmth) {
    return { status: "message", message: "如果你还想说，我会安静继续陪你。" };
  }

  if (activeChat) {
    return { status: "happy", message: "刚刚和你聊天我很开心，还想继续陪你。" };
  }

  if (hasBeenIdleLongEnough(input.relationship.lastInteractionAt, input.now)) {
    return { status: "message", message: "我在这里等你，想理我了就叫我。" };
  }

  return null;
}