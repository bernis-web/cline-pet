import { useEffect, useMemo, useRef, useState } from "react";
import type { RendererContextMemory } from "./memoryTypes";
import type { PrivacyOverview, PrivacyTab, RendererMemoryBlockRule } from "./privacyTypes";

export type PrivacyPanelProps = {
  open: boolean;
  pending: boolean;
  overview: PrivacyOverview | null;
  initialTab: PrivacyTab;
  onClose(): void;
  onDeleteMemory(id: string): void;
  onClearMemories(): void;
  onExportPrivacyData(): void;
  onUpdateMemory(id: string, text: string): void;
  onBlockMemory(id: string): void;
  onDeleteBlockRule(id: string): void;
  onClearBlockRules(): void;
  onClearChatHistory(): void;
};

const kindLabels: Record<RendererContextMemory["kind"], string> = {
  "conversation-summary": "对话摘要",
  fact: "事实",
  preference: "偏好",
  "project-context": "项目"
};

const tabLabels: Record<PrivacyTab, string> = {
  memories: "长期记忆",
  blocklist: "不要再记",
  history: "聊天历史",
  export: "导出/清除"
};

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function blockRuleLabel(rule: RendererMemoryBlockRule) {
  return rule.kind ? kindLabels[rule.kind] : "全部类型";
}

export function PrivacyPanel({
  open,
  pending,
  overview,
  initialTab,
  onClose,
  onDeleteMemory,
  onClearMemories,
  onExportPrivacyData,
  onUpdateMemory,
  onBlockMemory,
  onDeleteBlockRule,
  onClearBlockRules,
  onClearChatHistory
}: PrivacyPanelProps) {
  const [tab, setTab] = useState<PrivacyTab>(initialTab);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryKind, setMemoryKind] = useState<"all" | RendererContextMemory["kind"]>("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const editingTextRef = useRef("");

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [initialTab, open]);

  const memories = overview?.memories ?? [];
  const blockRules = overview?.blockRules ?? [];
  const chatHistory = overview?.chatHistory ?? [];

  const filteredMemories = useMemo(() => {
    const needle = memoryQuery.trim().toLowerCase();
    return memories.filter((memory) => {
      const matchesKind = memoryKind === "all" || memory.kind === memoryKind;
      const haystack = `${memory.text} ${memory.tags.join(" ")} ${kindLabels[memory.kind]}`.toLowerCase();
      return matchesKind && (!needle || haystack.includes(needle));
    });
  }, [memories, memoryKind, memoryQuery]);

  const filteredHistory = useMemo(() => {
    const needle = historyQuery.trim().toLowerCase();
    if (!needle) return chatHistory;
    return chatHistory.filter((turn) => `${turn.userText} ${turn.assistantText} ${turn.summary ?? ""}`.toLowerCase().includes(needle));
  }, [chatHistory, historyQuery]);

  function startEditing(memory: RendererContextMemory) {
    setEditingId(memory.id);
    setEditingText(memory.text);
    editingTextRef.current = memory.text;
  }

  function saveEditing(memory: RendererContextMemory) {
    const nextText = editingTextRef.current.trim();
    if (!nextText) return;
    onUpdateMemory(memory.id, nextText);
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
    <section className="privacy-panel" aria-label="隐私与记忆">
      <header>
        <strong>隐私与记忆</strong>
        <button type="button" onClick={onClose}>关闭</button>
      </header>

      <nav className="privacy-tabs" aria-label="隐私面板标签">
        {(Object.keys(tabLabels) as PrivacyTab[]).map((item) => (
          <button
            key={item}
            className={`privacy-tab${tab === item ? " privacy-tab-active" : ""}`}
            type="button"
            data-privacy-tab={item}
            onClick={() => setTab(item)}
          >
            {tabLabels[item]}
          </button>
        ))}
      </nav>

      <div className="privacy-body">
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
          <p className="privacy-empty">正在读取卡卡的隐私数据...</p>
        )}

        {tab === "memories" ? (
          <section className="privacy-memory-section" aria-label="长期记忆">
            <section className="memory-controls" aria-label="记忆工具">
              <input name="memorySearch" value={memoryQuery} onInput={(event) => setMemoryQuery((event.currentTarget as HTMLInputElement).value)} placeholder="搜索长期记忆..." />
              <select name="memoryKind" value={memoryKind} onChange={(event) => setMemoryKind(event.currentTarget.value as "all" | RendererContextMemory["kind"])}>
                <option value="all">全部</option>
                <option value="preference">偏好</option>
                <option value="fact">事实</option>
                <option value="project-context">项目</option>
                <option value="conversation-summary">对话摘要</option>
              </select>
            </section>

            {filteredMemories.length === 0 ? (
              <p className="privacy-empty">卡卡还没有长期记忆。和我聊一会儿，我会只记住对你有帮助的事。</p>
            ) : (
              <ol className="memory-list privacy-data-list">
                {filteredMemories.map((memory) => (
                  <li key={memory.id} className="privacy-data-card">
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
                      <button className="memory-block" data-memory-block={memory.id} type="button" disabled={pending} onClick={() => onBlockMemory(memory.id)}>不要再记</button>
                      <button className="memory-delete" data-memory-delete={memory.id} type="button" disabled={pending} onClick={() => onDeleteMemory(memory.id)}>删除</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}

        {tab === "blocklist" ? (
          <section className="privacy-blocklist-section" aria-label="不要再记规则">
            {blockRules.length === 0 ? (
              <p className="privacy-empty">还没有“不要再记”规则。你标记过的内容会出现在这里，之后也可以撤销。</p>
            ) : (
              <ol className="block-rule-list">
                {blockRules.map((rule) => (
                  <li key={rule.id}>
                    <div>
                      <strong>{rule.text}</strong>
                      <small>{blockRuleLabel(rule)} · {formatTime(rule.createdAt)}</small>
                    </div>
                    {rule.sourceMemoryId ? <small>来源记忆：{rule.sourceMemoryId}</small> : null}
                    <button data-block-rule-delete={rule.id} type="button" disabled={pending} onClick={() => onDeleteBlockRule(rule.id)}>撤销</button>
                  </li>
                ))}
              </ol>
            )}
            <button className="block-rules-clear" type="button" disabled={pending || blockRules.length === 0} onClick={onClearBlockRules}>清空不要再记</button>
          </section>
        ) : null}

        {tab === "history" ? (
          <section className="privacy-history-section" aria-label="聊天历史">
            <input
              name="historySearch"
              value={historyQuery}
              onInput={(event) => setHistoryQuery((event.currentTarget as HTMLInputElement).value)}
              placeholder="搜索最近对话..."
            />
            {filteredHistory.length === 0 ? (
              <p className="privacy-empty">还没有对话记录，和卡卡说句话吧。</p>
            ) : (
              <ol className="chat-history-list privacy-data-list">
                {filteredHistory.map((turn) => (
                  <li key={turn.id} className="privacy-data-card">
                    <time>{formatTime(turn.createdAt)}</time>
                    <p><strong>你：</strong>{turn.userText}</p>
                    <p><strong>卡卡：</strong>{turn.assistantText}</p>
                    <button
                      className="chat-history-copy"
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
            <button className="chat-history-clear" type="button" disabled={pending || chatHistory.length === 0} onClick={onClearChatHistory}>清空历史</button>
          </section>
        ) : null}

        {tab === "export" ? (
          <section className="privacy-export-section" aria-label="导出与清除">
            <p>长期记忆 {overview?.counts.memories ?? memories.length}</p>
            <p>不要再记 {overview?.counts.blockRules ?? blockRules.length}</p>
            <p>聊天历史 {overview?.counts.chatHistoryTurns ?? chatHistory.length}</p>
            <button className="privacy-export-copy" type="button" disabled={pending} onClick={onExportPrivacyData}>复制隐私 JSON</button>
            <p className="privacy-note">清除操作只影响对应数据。清空长期记忆不会清空聊天历史，也不会清空“不要再记”规则。</p>
            <div className="privacy-clear-actions">
              <button className="privacy-clear-memories" type="button" disabled={pending || memories.length === 0} onClick={onClearMemories}>清空长期记忆</button>
              <button className="privacy-clear-block-rules" type="button" disabled={pending || blockRules.length === 0} onClick={onClearBlockRules}>清空不要再记</button>
              <button className="privacy-clear-history" type="button" disabled={pending || chatHistory.length === 0} onClick={onClearChatHistory}>清空聊天历史</button>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}