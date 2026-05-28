import { PetStatus, toStatusLabel } from "../../shared/statuses";
import type { BubbleMessage } from "./bubbleTypes";
import { ChatInput } from "./ChatInput";
import { SpeechBubble } from "./SpeechBubble";

export type PetViewProps = {
  status: PetStatus;
  imageSrc: string;
  bubble: BubbleMessage | null;
  chatOpen: boolean;
  chatPending: boolean;
  onDiagnose(): void;
  onStartChat(): void;
  onChatSubmit(text: string): void;
  onChatCancel(): void;
};

export function PetView({ status, imageSrc, bubble, chatOpen, chatPending, onDiagnose, onStartChat, onChatSubmit, onChatCancel }: PetViewProps) {
  return (
    <main className="pet-shell">
      <SpeechBubble message={bubble} />
      <section className="drag-region pet-stage" onDoubleClick={onStartChat}>
        <img className={`pet-image pet-motion-${status}`} src={imageSrc} alt={toStatusLabel(status)} draggable={false} />
      </section>
      <ChatInput open={chatOpen} pending={chatPending} onSubmit={onChatSubmit} onCancel={onChatCancel} />
      <button className="diagnose-button" type="button" onClick={onDiagnose} aria-label="诊断">
        诊断
      </button>
    </main>
  );
}