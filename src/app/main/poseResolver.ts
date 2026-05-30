import type { PetStatus } from "../../shared/statuses.js";
import type { MoodName } from "./moodEngine.js";

export type PoseActivity = "idle" | "chatting" | "thinking" | "loading" | "message" | "dragging" | "patting";

export function resolveDisplayedPose(input: {
  mood: MoodName;
  activity: PoseActivity;
  bondStage: "new" | "familiar" | "close";
}): { status: PetStatus } {
  if (input.activity === "dragging") return { status: "dragging" };
  if (input.activity === "patting") return { status: "head-pat" };
  if (input.activity === "loading") return { status: "loading" };
  if (input.activity === "thinking") return { status: "thinking" };
  if (input.activity === "message") return { status: "message" };
  if (input.mood === "happy") return { status: "happy" };
  if (input.mood === "attached" && input.bondStage === "close") return { status: "head-pat" };
  if (input.mood === "sleepy") return { status: "sleepy" };
  if (input.mood === "upset") return { status: "angry" };
  if (input.mood === "curious") return { status: "thinking" };
  return { status: "idle" };
}