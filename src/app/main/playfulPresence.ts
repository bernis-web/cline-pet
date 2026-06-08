import type { PetStatus } from "../../shared/statuses.js";
import type { RelationshipMemory } from "./memory/memoryTypes.js";
import { getRelationshipPersona } from "./relationshipPersona.js";

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

function relationshipStage(relationship: RelationshipMemory) {
  const average = (relationship.familiarity + relationship.affection + relationship.engagement + relationship.trust) / 4;
  if (average >= 70) return "trusted" as const;
  if (average >= 45) return "close" as const;
  if (average >= 20) return "familiar" as const;
  return "new" as const;
}

function messagesForStage(stage: ReturnType<typeof relationshipStage>) {
  getRelationshipPersona(stage);

  if (stage === "trusted") {
    return {
      chatFollow: "刚刚和你聊天我很开心，还想继续陪着你。",
      attachedFollow: "要不要再摸摸我呀？我会更乖一点陪着你。",
      supportFollow: "如果你还想说，我会继续安静陪着你。",
      idleFollow: "我在这边等你，想叫我的时候我就在。",
      nightFollow: "我还在喔，晚一点要不要一起休息？"
    };
  }

  if (stage === "close") {
    return {
      chatFollow: "刚刚和你聊天我很开心，还想继续陪你。",
      attachedFollow: "要不要再摸摸我呀？我会更乖一点陪着你。",
      supportFollow: "如果你还想说，我会继续安静陪着你。",
      idleFollow: "我在这里等你，想理我了就叫我。",
      nightFollow: "我还在喔，晚一点要不要一起休息？"
    };
  }

  if (stage === "familiar") {
    return {
      chatFollow: "刚刚和你聊天我很开心，还想继续陪你。",
      attachedFollow: "要不要再摸摸我呀？我会乖一点。",
      supportFollow: "如果你还想说，我会安静继续陪你。",
      idleFollow: "我在这里等你，想理我了就叫我。",
      nightFollow: "我还在喔，晚一点要不要一起休息？"
    };
  }

  return {
    chatFollow: "刚刚和你聊天我很开心，还想继续陪你。",
    attachedFollow: "要不要再摸摸我呀？我会乖一点。",
    supportFollow: "如果你还想说，我会安静继续陪你。",
    idleFollow: "我在这里等你，想理我了就叫我。",
    nightFollow: "我还在喔，晚一点要不要一起休息？"
  };
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

  const stage = relationshipStage(input.relationship);
  const stageMessages = messagesForStage(stage);
  const activeChat = hasActiveWindow(input.relationship.playfulChatUntil, input.now);
  const activeAttached = hasActiveWindow(input.relationship.playfulAttachedUntil, input.now);
  const activeChatWarmth = input.relationship.recentWarmth?.source === "chat" && hasActiveWarmth(input.relationship, input.now);

  if (isNightHour(input.now)) {
    if (activeChat || activeAttached || activeChatWarmth) {
      return { status: "sleepy", message: stageMessages.nightFollow };
    }
    return null;
  }

  if (activeAttached) {
    return { status: "message", message: stageMessages.attachedFollow };
  }

  if (activeChatWarmth) {
    return { status: "message", message: stageMessages.supportFollow };
  }

  if (activeChat) {
    return { status: "happy", message: stageMessages.chatFollow };
  }

  if (hasBeenIdleLongEnough(input.relationship.lastInteractionAt, input.now)) {
    return { status: "message", message: stageMessages.idleFollow };
  }

  return null;
}