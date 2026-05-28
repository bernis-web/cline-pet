import { FormEvent, useState } from "react";

export type ChatInputProps = {
  open: boolean;
  pending: boolean;
  onSubmit(text: string): void;
  onCancel(): void;
};

export function ChatInput({ open, pending, onSubmit, onCancel }: ChatInputProps) {
  const [text, setText] = useState("");
  if (!open) return null;

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
        placeholder="和卡卡说话..."
        disabled={pending}
      />
      <button type="submit" disabled={pending}>发送</button>
      <button type="button" onClick={onCancel} disabled={pending}>取消</button>
    </form>
  );
}