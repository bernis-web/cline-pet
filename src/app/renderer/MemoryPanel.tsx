import { useMemo, useRef, useState } from "react";
import type { MemoryOverview, RendererContextMemory } from "./memoryTypes";

export type MemoryPanelProps = {
  open: boolean;
  pending: boolean;
  overview: MemoryOverview | null;
  onClose(): void;
  onDelete(id: string): void;
  onClear(): void;
  onExport(): void;
  onUpdate(id: string, text: string): void;
  onBlock(id: string): void;
};

const kindLabels: Record<RendererContextMemory["kind"], string> = {
  "conversation-summary": "对话摘要",
  fact: "事实",
  preference: "偏好",
  "project-context": "项目"
};

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

export function MemoryPanel({ open, pending, overview, onClose, onDelete, onClear, onExport, onUpdate, onBlock }: MemoryPanelProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | RendererContextMemory["kind"]>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const editingTextRef = useRef("");

  const memories = overview?.memories ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return memories.filter((memory) => {
      const matchesKind = kind === "all" || memory.kind === kind;
      const haystack = `${memory.text} ${memory.tags.join(" ")} ${kindLabels[memory.kind]}`.toLowerCase();
      const matchesQuery = !needle || haystack.includes(needle);
      return matchesKind && matchesQuery;
    });
  }, [kind, memories, query]);

  function startEditing(memory: RendererContextMemory) {
    setEditingId(memory.id);
    setEditingText(memory.text);
    editingTextRef.current = memory.text;
  }

  function saveEditing(memory: RendererContextMemory) {
    const nextText = editingTextRef.current.trim();
    if (!nextText) return;
    onUpdate(memory.id, nextText);
    setEditingId(null);
    setEditingText("");
    editingTextRef.current = "";
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingText("");
    editingTextRef.current = "";
  }

  function updateEditingText(value: string) {
    editingTextRef.current = value;
    setEditingText(value);
  }

  if (!open) return null;

  return (
    <section className="memory-panel" aria-label="记忆与关系">
      <header>
        <strong>记忆与关系</strong>
        <button type="button" onClick={onClose}>关闭</button>
      </header>

      {overview ? (
        <section className="relationship-card" aria-label="关系概览">
          <div>
            <strong>{overview.relationship.stageLabel}</strong>
            <p>{overview.relationship.stageDescription}</p>
          </div>
          <dl>
            <div className="relationship-score"><dt>熟悉度</dt><dd>{overview.relationship.familiarity}</dd></div>
            <div className="relationship-score"><dt>亲密度</dt><dd>{overview.relationship.affection}</dd></div>
            <div className="relationship-score"><dt>互动度</dt><dd>{overview.relationship.engagement}</dd></div>
            <div className="relationship-score"><dt>信任度</dt><dd>{overview.relationship.trust}</dd></div>
          </dl>
        </section>
      ) : (
        <p className="memory-empty">正在读取卡卡的记忆...</p>
      )}

      <section className="memory-controls" aria-label="记忆工具">
        <input name="memorySearch" value={query} onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)} placeholder="搜索长期记忆..." />
        <select name="memoryKind" value={kind} onChange={(event) => setKind(event.currentTarget.value as "all" | RendererContextMemory["kind"])}>
          <option value="all">全部</option>
          <option value="preference">偏好</option>
          <option value="fact">事实</option>
          <option value="project-context">项目</option>
          <option value="conversation-summary">对话摘要</option>
        </select>
        <button className="memory-export" type="button" disabled={pending || memories.length === 0} onClick={onExport}>导出</button>
        <button className="memory-clear" type="button" disabled={pending || memories.length === 0} onClick={onClear}>清空</button>
      </section>

      {filtered.length === 0 ? (
        <p className="memory-empty">卡卡还没有长期记忆。和我聊一会儿，我会只记住对你有帮助的事。</p>
      ) : (
        <ol className="memory-list">
          {filtered.map((memory) => (
            <li key={memory.id}>
              <div>
                <span className="memory-kind">{kindLabels[memory.kind]}</span>
                <time>{formatTime(memory.updatedAt)}</time>
              </div>
              {editingId === memory.id ? (
                <div className="memory-editor">
                  <textarea
                    name="memoryEditText"
                    value={editingText}
                    disabled={pending}
                    onInput={(event) => updateEditingText((event.currentTarget as HTMLTextAreaElement).value)}
                    aria-label="编辑长期记忆"
                  />
                  <div className="memory-editor-actions">
                    <button className="memory-edit-save" type="button" disabled={pending || editingText.trim().length === 0} onClick={() => saveEditing(memory)}>保存</button>
                    <button className="memory-edit-cancel" type="button" disabled={pending} onClick={cancelEditing}>取消</button>
                  </div>
                </div>
              ) : (
                <p>{memory.text}</p>
              )}
              <small>weight {memory.weight}{memory.tags.length > 0 ? ` · ${memory.tags.join(" · ")}` : ""}</small>
              <div className="memory-item-actions">
                <button className="memory-edit" data-memory-edit={memory.id} type="button" disabled={pending} onClick={() => startEditing(memory)}>编辑</button>
                <button className="memory-block" data-memory-block={memory.id} type="button" disabled={pending} onClick={() => onBlock(memory.id)}>不要再记</button>
                <button className="memory-delete" data-memory-delete={memory.id} type="button" disabled={pending} onClick={() => onDelete(memory.id)}>删除</button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}