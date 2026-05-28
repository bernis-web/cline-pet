import { PetStatus, toStatusLabel } from "../../shared/statuses";
import type { BubbleMessage } from "./bubbleTypes";
import { SpeechBubble } from "./SpeechBubble";

export type PetViewProps = {
  status: PetStatus;
  imageSrc: string;
  bubble: BubbleMessage | null;
  onDiagnose(): void;
  onStartChat(): void;
};

export function PetView({ status, imageSrc, bubble, onDiagnose, onStartChat }: PetViewProps) {
  return (
    <main className="pet-shell">
      <SpeechBubble message={bubble} />
      <section className="drag-region pet-stage" onDoubleClick={onStartChat}>
        <img className="pet-image" src={imageSrc} alt={toStatusLabel(status)} draggable={false} />
      </section>
      <button className="diagnose-button" type="button" onClick={onDiagnose} aria-label="诊断">
        诊断
      </button>
    </main>
  );
}