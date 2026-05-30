import { FormEvent, useEffect, useState, type KeyboardEvent } from "react";

export type ChatInputProps = {
  open: boolean;
  pending: boolean;
  onSubmit(text: string): void;
  onCancel(): void;
};

export function ChatInput({ open, pending, onSubmit, onCancel }: ChatInputProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open || pending || text.trim()) return;
    const timer = window.setTimeout(onCancel, 12000);
    return () => window.clearTimeout(timer);
  }, [open, pending, text, onCancel]);

  if (!open) return null;

  function cancelWithEscape(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && !pending) onCancel();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const trimmed = String(formData.get("message") ?? "").trim();
    if (!trimmed || pending) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <form className="chat-input" onSubmit={submit}>
      <input
        name="message"
        value={text}
        onInput={(event) => setText((event.currentTarget as HTMLInputElement).value)}
        onKeyDown={cancelWithEscape}
        placeholder="和卡卡说话..."
        disabled={pending}
      />
      <button type="submit" disabled={pending}>发送</button>
      <button type="button" onClick={onCancel} disabled={pending}>取消</button>
    </form>
  );
}