import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { PetStatus, toStatusLabel } from "../../shared/statuses";
import type { BubbleMessage } from "./bubbleTypes";
import { ChatInput } from "./ChatInput";
import { SpeechBubble } from "./SpeechBubble";

const HEAD_PAT_DELAY_MS = 400;
const HEAD_PAT_MIN_DURATION_MS = 600;
const DRAG_THRESHOLD_PX = 10;

type HeadPatInteractionInput = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

type PointerState =
  | { kind: "pending"; startX: number; startY: number; lastX: number; lastY: number; timer: number }
  | { kind: "patting"; startX: number; startY: number; lastX: number; lastY: number; patStartedAt: number; startedAtIso: string }
  | { kind: "dragging"; lastX: number; lastY: number };

export type PetViewProps = {
  status: PetStatus;
  imageSrc: string;
  bubble: BubbleMessage | null;
  chatOpen: boolean;
  chatPending: boolean;
  onOpenSettings(): void;
  onHeadPatStart(): void;
  onHeadPatEnd(input: HeadPatInteractionInput): void;
  onHeadPatCancel(): void;
  onStartChat(): void;
  onMoveWindowBy(dx: number, dy: number): void;
  onChatSubmit(text: string): void;
  onChatCancel(): void;
};

export function PetView({ status, imageSrc, bubble, chatOpen, chatPending, onOpenSettings, onHeadPatStart, onHeadPatEnd, onHeadPatCancel, onStartChat, onMoveWindowBy, onChatSubmit, onChatCancel }: PetViewProps) {
  const pointer = useRef<PointerState | null>(null);

  function distanceFromStart(state: { startX: number; startY: number }, event: MouseEvent | ReactMouseEvent) {
    return Math.hypot(event.screenX - state.startX, event.screenY - state.startY);
  }

  function clearPendingTimer() {
    const state = pointer.current;
    if (state?.kind === "pending") window.clearTimeout(state.timer);
  }

  useEffect(() => {
    function moveWindow(event: MouseEvent) {
      const state = pointer.current;
      if (!state) return;
      if (event.buttons === 0) {
        finishPointerInteraction();
        return;
      }

      if (state.kind === "pending") {
        if (distanceFromStart(state, event) < DRAG_THRESHOLD_PX) return;
        window.clearTimeout(state.timer);
        pointer.current = { kind: "dragging", lastX: state.lastX, lastY: state.lastY };
      }

      const active = pointer.current;
      if (!active) return;
      if (active.kind === "dragging") {
        const dx = event.screenX - active.lastX;
        const dy = event.screenY - active.lastY;
        pointer.current = { kind: "dragging", lastX: event.screenX, lastY: event.screenY };
        if (dx || dy) onMoveWindowBy(dx, dy);
      } else if (active.kind === "patting") {
        pointer.current = { ...active, lastX: event.screenX, lastY: event.screenY };
      }
    }

    function finishPointerInteraction() {
      const state = pointer.current;
      if (!state) return;
      clearPendingTimer();
      pointer.current = null;

      if (state.kind !== "patting") {
        onHeadPatCancel();
        return;
      }

      const endedAt = new Date();
      const durationMs = endedAt.getTime() - state.patStartedAt;
      onHeadPatCancel();
      if (durationMs >= HEAD_PAT_MIN_DURATION_MS) {
        onHeadPatEnd({ startedAt: state.startedAtIso, endedAt: endedAt.toISOString(), durationMs });
      }
    }

    window.addEventListener("mousemove", moveWindow);
    window.addEventListener("mouseup", finishPointerInteraction);
    return () => {
      window.removeEventListener("mousemove", moveWindow);
      window.removeEventListener("mouseup", finishPointerInteraction);
    };
  }, [onHeadPatCancel, onHeadPatEnd, onMoveWindowBy]);

  function openSettings(event: ReactMouseEvent) {
    event.preventDefault();
    onOpenSettings();
  }

  function startPointerInteraction(event: ReactMouseEvent) {
    if (event.button !== 0) return;
    clearPendingTimer();
    const startX = event.screenX;
    const startY = event.screenY;
    const timer = window.setTimeout(() => {
      const state = pointer.current;
      if (!state || state.kind !== "pending") return;
      const now = new Date();
      pointer.current = {
        kind: "patting",
        startX: state.startX,
        startY: state.startY,
        lastX: state.lastX,
        lastY: state.lastY,
        patStartedAt: now.getTime(),
        startedAtIso: now.toISOString()
      };
      onHeadPatStart();
    }, HEAD_PAT_DELAY_MS);

    pointer.current = { kind: "pending", startX, startY, lastX: startX, lastY: startY, timer };
  }

  return (
    <main className="pet-shell">
      <SpeechBubble message={bubble} />
      <section className="pet-stage" onMouseDown={startPointerInteraction} onDoubleClick={onStartChat} onContextMenu={openSettings} title="拖动移动，长按轻摸，双击聊天，右键设置">
        <img className={`pet-image pet-motion-${status}`} src={imageSrc} alt={toStatusLabel(status)} draggable={false} />
      </section>
      <ChatInput open={chatOpen} pending={chatPending} onSubmit={onChatSubmit} onCancel={onChatCancel} />
    </main>
  );
}