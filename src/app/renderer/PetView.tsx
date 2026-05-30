import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { PetStatus, toStatusLabel } from "../../shared/statuses";
import type { BubbleMessage } from "./bubbleTypes";
import { ChatInput } from "./ChatInput";
import { SpeechBubble } from "./SpeechBubble";

type DragState = {
  lastX: number;
  lastY: number;
};

export type PetViewProps = {
  status: PetStatus;
  imageSrc: string;
  bubble: BubbleMessage | null;
  chatOpen: boolean;
  chatPending: boolean;
  onOpenSettings(): void;
  onStartChat(): void;
  onMoveWindowBy(dx: number, dy: number): void;
  onChatSubmit(text: string): void;
  onChatCancel(): void;
};

export function PetView({ status, imageSrc, bubble, chatOpen, chatPending, onOpenSettings, onStartChat, onMoveWindowBy, onChatSubmit, onChatCancel }: PetViewProps) {
  const drag = useRef<DragState | null>(null);

  useEffect(() => {
    function moveWindow(event: MouseEvent) {
      if (!drag.current) return;
      if (event.buttons === 0) {
        drag.current = null;
        return;
      }

      const dx = event.screenX - drag.current.lastX;
      const dy = event.screenY - drag.current.lastY;
      drag.current = { lastX: event.screenX, lastY: event.screenY };
      if (dx || dy) onMoveWindowBy(dx, dy);
    }

    function stopDragging() {
      drag.current = null;
    }

    window.addEventListener("mousemove", moveWindow);
    window.addEventListener("mouseup", stopDragging);
    return () => {
      window.removeEventListener("mousemove", moveWindow);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, [onMoveWindowBy]);

  function openSettings(event: ReactMouseEvent) {
    event.preventDefault();
    onOpenSettings();
  }

  function startDragging(event: ReactMouseEvent) {
    if (event.button !== 0) return;
    drag.current = { lastX: event.screenX, lastY: event.screenY };
  }

  return (
    <main className="pet-shell">
      <SpeechBubble message={bubble} />
      <section className="pet-stage" onMouseDown={startDragging} onDoubleClick={onStartChat} onContextMenu={openSettings} title="拖动移动，双击聊天，右键设置">
        <img className={`pet-image pet-motion-${status}`} src={imageSrc} alt={toStatusLabel(status)} draggable={false} />
      </section>
      <ChatInput open={chatOpen} pending={chatPending} onSubmit={onChatSubmit} onCancel={onChatCancel} />
    </main>
  );
}