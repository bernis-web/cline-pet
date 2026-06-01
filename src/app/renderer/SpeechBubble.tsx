import type { BubbleMessage } from "./bubbleTypes";

export type SpeechBubbleProps = {
  message: BubbleMessage | null;
  onOpenReadable?(): void;
  onClose?(): void;
};

export function SpeechBubble({ message, onOpenReadable, onClose }: SpeechBubbleProps) {
  if (!message) return null;
  const canOpen = message.kind === "chat" && message.mode === "transient" && message.isLongText;

  return (
    <section className="speech-bubble" data-kind={message.kind} data-mode={message.mode} aria-live="polite" onClick={canOpen ? onOpenReadable : undefined}>
      {message.mode === "readable" && (
        <button
          className="speech-bubble-close"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose?.();
          }}
        >
          ×
        </button>
      )}
      <span className="speech-bubble-text">{message.text}</span>
      {canOpen && <span className="speech-bubble-hint">点开读完</span>}
    </section>
  );
}