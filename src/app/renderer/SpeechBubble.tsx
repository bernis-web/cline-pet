import type { BubbleMessage } from "./bubbleTypes";

export type SpeechBubbleProps = {
  message: BubbleMessage | null;
};

export function SpeechBubble({ message }: SpeechBubbleProps) {
  if (!message) return null;

  return (
    <section className="speech-bubble" data-kind={message.kind} aria-live="polite">
      <span className="speech-bubble-text">{message.text}</span>
    </section>
  );
}