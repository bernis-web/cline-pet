import { useEffect, useRef, useState } from "react";
import { PetStatus } from "../../shared/statuses";
import { DeepSeekSettingsPanel } from "./DeepSeekSettingsPanel";
import { PetView } from "./PetView";
import { PrivacyPanel } from "./PrivacyPanel";
import { bubbleFromChat, bubbleFromNotice, bubbleFromStatus, type BubbleMessage } from "./bubbleTypes";
import { enqueueBubble, makeBubbleReadable, popNextBubble } from "./bubbleQueue";
import type { PrivacyTab } from "./privacyTypes";
import type { BlockMemoryResponse, BlockRuleMutationResponse, ChatHistoryResponse, ClearChatHistoryResponse, ClearMemoriesResponse, DeepSeekSettings, DeepSeekSettingsInput, DeepSeekSettingsResponse, DeleteMemoryResponse, ExportMemoriesResponse, MemoryOverviewResponse, PrivacyExportResponse, PrivacyOverview, PrivacyOverviewResponse, RendererPetPack, UpdateMemoryResponse } from "./petBridge";
import idleImage from "../../assets/default-pet/idle.svg";
import thinkingImage from "../../assets/default-pet/thinking.svg";
import workingImage from "../../assets/default-pet/working.svg";
import waitingApprovalImage from "../../assets/default-pet/waiting-approval.svg";
import doneImage from "../../assets/default-pet/done.svg";
import errorImage from "../../assets/default-pet/error.svg";

declare global {
  interface Window {
    clinePet?: {
      onPetStatus(callback: (payload: { status: PetStatus; visibleStatus: PetStatus; baseStatus: PetStatus; overlayStatus: PetStatus | null; task?: string; message?: string; updatedAt?: string; normalizedFrom?: string }) => void): void;
      onPetPack(callback: (payload: RendererPetPack) => void): void;
      getPetPack?(): Promise<RendererPetPack>;
      sendChatMessage?(text: string): Promise<{ ok: true; text: string } | { ok: false; errorCode: string; message: string }>;
      getChatHistory?(): Promise<ChatHistoryResponse>;
      clearChatHistory?(): Promise<ClearChatHistoryResponse>;
      getMemoryOverview?(): Promise<MemoryOverviewResponse>;
      deleteMemory?(id: string): Promise<DeleteMemoryResponse>;
      clearMemories?(): Promise<ClearMemoriesResponse>;
      exportMemories?(): Promise<ExportMemoriesResponse>;
      updateMemory?(id: string, text: string): Promise<UpdateMemoryResponse>;
      blockMemory?(id: string): Promise<BlockMemoryResponse>;
      getPrivacyOverview?(): Promise<PrivacyOverviewResponse>;
      exportPrivacyData?(): Promise<PrivacyExportResponse>;
      deleteMemoryBlockRule?(id: string): Promise<BlockRuleMutationResponse>;
      clearMemoryBlockRules?(): Promise<BlockRuleMutationResponse>;
      blockChatHistoryTurn?(id: string): Promise<BlockRuleMutationResponse>;
      setPresenceActivity?(input: { userIsReading?: boolean }): Promise<{ ok: true } | { ok: false; message: string }>;
      getDeepSeekSettings?(): Promise<DeepSeekSettingsResponse>;
      saveDeepSeekSettings?(input: DeepSeekSettingsInput): Promise<DeepSeekSettingsResponse>;
      movePetWindowBy?(dx: number, dy: number): Promise<{ ok: boolean; message?: string }>;
      reportHeadPatInteraction?(input: { startedAt: string; endedAt: string; durationMs: number }): Promise<{ ok: true } | { ok: false; errorCode: string; message: string }>;
      onChatResponse?(callback: (payload: { ok: true; text: string } | { ok: false; errorCode: string; message: string }) => void): void;
    };
  }
}

const defaultImages: Record<PetStatus, string> = {
  idle: idleImage,
  happy: doneImage,
  sleepy: idleImage,
  thinking: thinkingImage,
  angry: errorImage,
  "not-found": errorImage,
  message: waitingApprovalImage,
  sleeping: idleImage,
  "head-pat": doneImage,
  dragging: workingImage,
  loading: workingImage,
  "signal-weak": errorImage
};

export function App() {
  const [visibleStatus, setVisibleStatus] = useState<PetStatus>("idle");
  const [temporaryStatus, setTemporaryStatus] = useState<PetStatus | null>(null);
  const [temporaryImageSrc, setTemporaryImageSrc] = useState<string | null>(null);
  const [bubbleState, setBubbleState] = useState<{ current: BubbleMessage | null; queue: BubbleMessage[] }>({ current: null, queue: [] });
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPending, setChatPending] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacyInitialTab, setPrivacyInitialTab] = useState<PrivacyTab>("memories");
  const [privacyPending, setPrivacyPending] = useState(false);
  const [privacyOverview, setPrivacyOverview] = useState<PrivacyOverview | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);
  const [deepSeekSettings, setDeepSeekSettings] = useState<DeepSeekSettings | null>(null);
  const [images, setImages] = useState(defaultImages);
  const [variants, setVariants] = useState<Partial<Record<PetStatus, string[]>>>({});
  const lastPresenceReading = useRef(false);
  const bubble = bubbleState.current;

  function pushBubble(next: BubbleMessage | null) {
    if (!next) return;
    setBubbleState((state) => enqueueBubble(state, next));
  }

  function pushReplacingNotice(text: string) {
    const notice = bubbleFromNotice(text);
    setBubbleState((state) => state.current?.kind === "notice"
      ? { current: notice, queue: state.queue.filter((item) => item.kind !== "notice") }
      : enqueueBubble(state, notice));
  }

  function applyPack(payload: RendererPetPack) {
    setImages({ ...defaultImages, ...payload.stateImages });
    setVariants(payload.variants ?? {});
  }

  function pickVariant(status: PetStatus) {
    const choices = variants[status];
    if (!choices?.length) return null;
    return choices[Math.floor(Math.random() * choices.length)] ?? null;
  }

  function clearTemporaryPose() {
    setTemporaryStatus(null);
    setTemporaryImageSrc(null);
  }

  async function refreshDeepSeekSettings() {
    const result = await window.clinePet?.getDeepSeekSettings?.();
    if (!result) return;
    if (result.ok) {
      setDeepSeekSettings(result.data);
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function openDeepSeekSettings() {
    setSettingsOpen(true);
    await refreshDeepSeekSettings();
  }

  async function saveDeepSeekSettings(input: DeepSeekSettingsInput) {
    setSettingsPending(true);
    const result = await window.clinePet?.saveDeepSeekSettings?.(input);
    setSettingsPending(false);

    if (!result) {
      pushBubble(bubbleFromNotice("DeepSeek 设置通道还没有准备好。"));
      return;
    }

    if (result.ok) {
      setDeepSeekSettings(result.data);
      setSettingsOpen(false);
      pushBubble(bubbleFromNotice("DeepSeek 已保存，可以直接聊天啦。"));
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function reportHeadPatInteraction(input: { startedAt: string; endedAt: string; durationMs: number }) {
    clearTemporaryPose();
    try {
      await window.clinePet?.reportHeadPatInteraction?.(input);
    } catch {
      // Head-pat feedback should remain local even if persistence is unavailable.
    }
  }

  async function refreshPrivacyOverview() {
    setPrivacyPending(true);
    const result = await window.clinePet?.getPrivacyOverview?.();
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      setPrivacyOverview(result.data);
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function openPrivacyPanel(tab: PrivacyTab) {
    setPrivacyInitialTab(tab);
    setPrivacyOpen(true);
    await refreshPrivacyOverview();
  }

  async function clearChatHistoryFromPanel() {
    const confirmed = typeof window.confirm === "function" ? window.confirm("清空本地对话历史？") : true;
    if (!confirmed) return;
    setPrivacyPending(true);
    const result = await window.clinePet?.clearChatHistory?.();
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      await refreshPrivacyOverview();
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function blockChatHistoryTurnFromPanel(id: string) {
    const confirmed = typeof window.confirm === "function"
      ? window.confirm("这会让卡卡以后避免把“你说的这句话”整理成长期记忆。不会删除这条聊天历史，也不会删除已有长期记忆。继续吗？")
      : true;
    if (!confirmed) return;

    setPrivacyPending(true);
    const result = await window.clinePet?.blockChatHistoryTurn?.(id);
    setPrivacyPending(false);

    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }

    if (result.ok) {
      await refreshPrivacyOverview();
      pushReplacingNotice("好，我以后不会把这句话整理成长期记忆。");
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function deleteMemoryFromPanel(id: string) {
    const confirmed = typeof window.confirm === "function" ? window.confirm("删除这条长期记忆？之后卡卡不会再用它理解你。") : true;
    if (!confirmed) return;
    setPrivacyPending(true);
    const result = await window.clinePet?.deleteMemory?.(id);
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      await refreshPrivacyOverview();
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function updateMemoryFromPanel(id: string, text: string) {
    const confirmed = typeof window.confirm === "function" ? window.confirm("保存这条长期记忆的修改？") : true;
    if (!confirmed) return;
    setPrivacyPending(true);
    const result = await window.clinePet?.updateMemory?.(id, text);
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      await refreshPrivacyOverview();
      pushReplacingNotice("我记住修正啦。");
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function blockMemoryFromPanel(id: string) {
    const confirmed = typeof window.confirm === "function" ? window.confirm("删除这条长期记忆，并让卡卡以后不要再记类似内容？") : true;
    if (!confirmed) return;
    setPrivacyPending(true);
    const result = await window.clinePet?.blockMemory?.(id);
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      await refreshPrivacyOverview();
      pushReplacingNotice("好，我以后不会再记类似内容。");
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function clearMemoriesFromPanel() {
    const confirmed = typeof window.confirm === "function" ? window.confirm("清空所有长期记忆？对话历史不会被删除，但卡卡会忘掉已提炼的长期记忆。") : true;
    if (!confirmed) return;
    setPrivacyPending(true);
    const result = await window.clinePet?.clearMemories?.();
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      await refreshPrivacyOverview();
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function deleteBlockRuleFromPanel(id: string) {
    const confirmed = typeof window.confirm === "function" ? window.confirm("撤销这条“不要再记”规则？以后类似内容可能会再次被卡卡提炼为长期记忆。") : true;
    if (!confirmed) return;
    setPrivacyPending(true);
    const result = await window.clinePet?.deleteMemoryBlockRule?.(id);
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      await refreshPrivacyOverview();
      pushReplacingNotice("这条不要再记规则已撤销。");
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function clearBlockRulesFromPanel() {
    const confirmed = typeof window.confirm === "function" ? window.confirm("清空所有“不要再记”规则？这不会恢复已删除的长期记忆，但以后类似内容可能会再次被记住。") : true;
    if (!confirmed) return;
    setPrivacyPending(true);
    const result = await window.clinePet?.clearMemoryBlockRules?.();
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (result.ok) {
      await refreshPrivacyOverview();
      pushReplacingNotice("不要再记规则已清空。");
    } else {
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  async function exportPrivacyDataFromPanel() {
    setPrivacyPending(true);
    const result = await window.clinePet?.exportPrivacyData?.();
    setPrivacyPending(false);
    if (!result) {
      pushBubble(bubbleFromNotice("隐私数据通道还没有准备好。"));
      return;
    }
    if (!result.ok) {
      pushBubble(bubbleFromNotice(result.message));
      return;
    }
    try {
      await navigator.clipboard?.writeText?.(result.data);
      pushBubble(bubbleFromNotice("隐私数据 JSON 已复制到剪贴板。"));
    } catch {
      pushBubble(bubbleFromNotice("剪贴板不可用，暂时无法复制隐私数据。"));
    }
  }

  async function sendChat(text: string) {
    setChatPending(true);
    pushBubble({
      id: `notice-${Date.now()}`,
      kind: "notice",
      text: "卡卡正在想...",
      createdAt: new Date().toISOString(),
      autoHideMs: 3000,
      mode: "transient",
      isLongText: false
    });

    const result = await window.clinePet?.sendChatMessage?.(text);
    setChatPending(false);

    if (!result) {
      pushBubble(bubbleFromNotice("聊天通道还没有准备好。"));
      return;
    }

    if (result.ok) {
      pushBubble(bubbleFromChat(result.text));
      setChatOpen(false);
      if (privacyOpen) void refreshPrivacyOverview();
    } else {
      if (result.errorCode === "DEEPSEEK_API_KEY_MISSING") {
        setSettingsOpen(true);
        await refreshDeepSeekSettings();
      }
      pushBubble(bubbleFromNotice(result.message));
    }
  }

  useEffect(() => {
    window.clinePet?.onPetStatus((payload) => {
      setVisibleStatus(payload.visibleStatus ?? payload.status);
      const nextBubble = bubbleFromStatus(payload);
      if (nextBubble) pushBubble(nextBubble);
    });

    window.clinePet?.onPetPack((payload) => applyPack(payload));
    window.clinePet?.getPetPack?.().then((payload) => applyPack(payload)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!bubble?.autoHideMs) return;
    const bubbleId = bubble.id;
    const timer = window.setTimeout(() => {
      setBubbleState((current) => current.current?.id === bubbleId ? popNextBubble({ current: null, queue: current.queue }) : current);
    }, bubble.autoHideMs);
    return () => window.clearTimeout(timer);
  }, [bubble]);

  useEffect(() => {
    const userIsReading = bubble?.kind === "chat" && bubble.mode === "readable";
    if (lastPresenceReading.current === userIsReading) return;
    lastPresenceReading.current = userIsReading;

    try {
      const result = window.clinePet?.setPresenceActivity?.({ userIsReading });
      Promise.resolve(result).catch(() => undefined);
    } catch {
      // Presence reporting is best-effort; reading UI should never break if IPC is unavailable.
    }
  }, [bubble?.id, bubble?.kind, bubble?.mode]);

  const displayStatus = temporaryStatus ?? visibleStatus;
  const displayImageSrc = temporaryImageSrc ?? images[displayStatus] ?? defaultImages.idle;

  return (
    <>
      <PetView
        status={displayStatus}
        imageSrc={displayImageSrc}
        bubble={bubble}
        chatOpen={chatOpen}
        chatPending={chatPending}
        onStartChat={() => setChatOpen((open) => !open)}
        onOpenHistory={() => void openPrivacyPanel("history")}
        onOpenMemory={() => void openPrivacyPanel("memories")}
        onOpenReadableBubble={() => setBubbleState((state) => state.current ? { ...state, current: makeBubbleReadable(state.current) } : state)}
        onCloseBubble={() => setBubbleState((state) => popNextBubble({ current: null, queue: state.queue }))}
        onOpenSettings={openDeepSeekSettings}
        onHeadPatStart={() => {
          setTemporaryStatus("head-pat");
          setTemporaryImageSrc(pickVariant("head-pat"));
        }}
        onHeadPatEnd={reportHeadPatInteraction}
        onHeadPatCancel={clearTemporaryPose}
        onDragStart={() => {
          setTemporaryStatus("dragging");
          setTemporaryImageSrc(null);
        }}
        onMoveWindowBy={(dx, dy) => {
          try {
            Promise.resolve(window.clinePet?.movePetWindowBy?.(dx, dy)).catch(() => undefined);
          } catch {
            // Ignore movement failures; dragging should never break chat/status UI.
          }
        }}
        onChatSubmit={sendChat}
        onChatCancel={() => setChatOpen(false)}
      />
      <PrivacyPanel
        open={privacyOpen}
        pending={privacyPending}
        overview={privacyOverview}
        initialTab={privacyInitialTab}
        onClose={() => setPrivacyOpen(false)}
        onDeleteMemory={deleteMemoryFromPanel}
        onClearMemories={clearMemoriesFromPanel}
        onExportPrivacyData={exportPrivacyDataFromPanel}
        onUpdateMemory={updateMemoryFromPanel}
        onBlockMemory={blockMemoryFromPanel}
        onDeleteBlockRule={deleteBlockRuleFromPanel}
        onClearBlockRules={clearBlockRulesFromPanel}
        onClearChatHistory={clearChatHistoryFromPanel}
        onBlockChatHistoryTurn={blockChatHistoryTurnFromPanel}
      />
      <DeepSeekSettingsPanel open={settingsOpen} pending={settingsPending} settings={deepSeekSettings} onSave={saveDeepSeekSettings} onCancel={() => setSettingsOpen(false)} />
    </>
  );
}