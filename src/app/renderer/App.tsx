import { useEffect, useState } from "react";
import { PetStatus } from "../../shared/statuses";
import { DeepSeekSettingsPanel } from "./DeepSeekSettingsPanel";
import { PetView } from "./PetView";
import { bubbleFromChat, bubbleFromNotice, bubbleFromStatus, type BubbleMessage } from "./bubbleTypes";
import type { DeepSeekSettings, DeepSeekSettingsInput, DeepSeekSettingsResponse } from "./petBridge";
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
      onPetPack(callback: (payload: { stateImages: Record<PetStatus, string> }) => void): void;
      getPetPack?(): Promise<{ stateImages: Record<PetStatus, string> }>;
      sendChatMessage?(text: string): Promise<{ ok: true; text: string } | { ok: false; errorCode: string; message: string }>;
      getDeepSeekSettings?(): Promise<DeepSeekSettingsResponse>;
      saveDeepSeekSettings?(input: DeepSeekSettingsInput): Promise<DeepSeekSettingsResponse>;
      movePetWindowBy?(dx: number, dy: number): Promise<{ ok: boolean; message?: string }>;
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
  const [bubble, setBubble] = useState<BubbleMessage | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPending, setChatPending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPending, setSettingsPending] = useState(false);
  const [deepSeekSettings, setDeepSeekSettings] = useState<DeepSeekSettings | null>(null);
  const [images, setImages] = useState(defaultImages);

  async function refreshDeepSeekSettings() {
    const result = await window.clinePet?.getDeepSeekSettings?.();
    if (!result) return;
    if (result.ok) {
      setDeepSeekSettings(result.data);
    } else {
      setBubble(bubbleFromNotice(result.message));
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
      setBubble(bubbleFromNotice("DeepSeek 设置通道还没有准备好。"));
      return;
    }

    if (result.ok) {
      setDeepSeekSettings(result.data);
      setSettingsOpen(false);
      setBubble(bubbleFromNotice("DeepSeek 已保存，可以直接聊天啦。"));
    } else {
      setBubble(bubbleFromNotice(result.message));
    }
  }

  async function sendChat(text: string) {
    setChatPending(true);
    setBubble({
      id: `notice-${Date.now()}`,
      kind: "notice",
      text: "卡卡正在想...",
      createdAt: new Date().toISOString(),
      autoHideMs: 3000
    });

    const result = await window.clinePet?.sendChatMessage?.(text);
    setChatPending(false);

    if (!result) {
      setBubble(bubbleFromNotice("聊天通道还没有准备好。"));
      return;
    }

    if (result.ok) {
      setBubble(bubbleFromChat(result.text));
      setChatOpen(false);
    } else {
      if (result.errorCode === "DEEPSEEK_API_KEY_MISSING") {
        setSettingsOpen(true);
        await refreshDeepSeekSettings();
      }
      setBubble(bubbleFromNotice(result.message));
    }
  }

  useEffect(() => {
    window.clinePet?.onPetStatus((payload) => {
      setVisibleStatus(payload.visibleStatus ?? payload.status);
      const nextBubble = bubbleFromStatus(payload);
      if (nextBubble) setBubble(nextBubble);
    });

    window.clinePet?.onPetPack((payload) => setImages({ ...defaultImages, ...payload.stateImages }));
    window.clinePet?.getPetPack?.().then((payload) => setImages({ ...defaultImages, ...payload.stateImages })).catch(() => undefined);
  }, []);

  return (
    <>
      <PetView
        status={visibleStatus}
        imageSrc={images[visibleStatus] ?? defaultImages.idle}
        bubble={bubble}
        chatOpen={chatOpen}
        chatPending={chatPending}
        onStartChat={() => setChatOpen((open) => !open)}
        onOpenSettings={openDeepSeekSettings}
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
      <DeepSeekSettingsPanel open={settingsOpen} pending={settingsPending} settings={deepSeekSettings} onSave={saveDeepSeekSettings} onCancel={() => setSettingsOpen(false)} />
    </>
  );
}