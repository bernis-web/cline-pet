import { useMemo, useState } from "react";
import type { RendererChatHistoryTurn } from "./chatHistoryTypes";

export type ChatHistoryPanelProps = {
  open: boolean;
  turns: RendererChatHistoryTurn[];
  pending: boolean;
  onClose(): void;
  onClear(): void;
};

export function ChatHistoryPanel({ open, turns, pending, onClose, onClear }: ChatHistoryPanelProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return turns;
    return turns.filter((turn) => `${turn.userText} ${turn.assistantText} ${turn.summary ?? ""}`.toLowerCase().includes(needle));
  }, [query, turns]);

  if (!open) return null;

  return (
    <section className="chat-history-panel" aria-label="对话历史">
      <header>
        <strong>对话历史</strong>
        <button type="button" onClick={onClose}>关闭</button>
      </header>
      <input
        name="historySearch"
        value={query}
        onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
        placeholder="搜索最近对话..."
      />
      {filtered.length === 0 ? (
        <p className="chat-history-empty">还没有对话记录，和卡卡说句话吧。</p>
      ) : (
        <ol className="chat-history-list">
          {filtered.map((turn) => (
            <li key={turn.id}>
              <time>{new Date(turn.createdAt).toLocaleString()}</time>
              <p><strong>你：</strong>{turn.userText}</p>
              <p><strong>卡卡：</strong>{turn.assistantText}</p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText?.(`你：${turn.userText}\n卡卡：${turn.assistantText}`);
                }}
              >
                复制
              </button>
            </li>
          ))}
        </ol>
      )}
      <footer>
        <button className="chat-history-clear" type="button" disabled={pending || turns.length === 0} onClick={onClear}>清空历史</button>
      </footer>
    </section>
  );
}