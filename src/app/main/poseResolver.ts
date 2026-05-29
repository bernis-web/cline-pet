import type { PetStatus } from "../../shared/statuses.js";
import type { MoodName } from "./moodEngine.js";

export function resolveDisplayedPose(input: {
  mood: MoodName;
  activity: "idle" | "chatting" | "thinking" | "loading" | "message" | "dragging";
  bondStage: "new" | "familiar" | "close";
}): { status: PetStatus } {
  if (input.activity === "dragging") return { status: "dragging" };
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