import type { BubbleMessage } from "./bubbleTypes";

export type BubbleQueueState = {
  current: BubbleMessage | null;
  queue: BubbleMessage[];
};

function priority(bubble: BubbleMessage) {
  if (bubble.kind === "chat") return 4;
  if (bubble.kind === "notice" || bubble.kind === "diagnostics") return 3;
  if (bubble.kind === "status") return 2;
  return 1;
}

export function enqueueBubble(state: BubbleQueueState, next: BubbleMessage): BubbleQueueState {
  if (state.current?.mode === "readable" && priority(next) < priority(state.current)) {
    return state;
  }
  if (!state.current) return { current: next, queue: state.queue };
  if (priority(next) > priority(state.current)) {
    return { current: next, queue: state.queue };
  }
  const queue = [...state.queue, next]
    .sort((a, b) => priority(b) - priority(a) || a.createdAt.localeCompare(b.createdAt))
    .slice(0, 5);
  return { current: state.current, queue };
}

export function popNextBubble(state: BubbleQueueState): BubbleQueueState {
  const [current, ...queue] = state.queue;
  return { current: current ?? null, queue };
}

export function makeBubbleReadable(bubble: BubbleMessage): BubbleMessage {
  return { ...bubble, mode: "readable", autoHideMs: null };
}