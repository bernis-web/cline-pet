import { useEffect, useState } from "react";
import { PetStatus } from "../../shared/statuses";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { PetView } from "./PetView";
import { bubbleFromChat, bubbleFromDiagnostics, bubbleFromNotice, bubbleFromStatus, type BubbleMessage } from "./bubbleTypes";
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
  const [status, setStatus] = useState<PetStatus>("idle");
  const [visibleStatus, setVisibleStatus] = useState<PetStatus>("idle");
  const [bubble, setBubble] = useState<BubbleMessage | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPending, setChatPending] = useState(false);
  const [diagnostics, setDiagnostics] = useState("");
  const [images, setImages] = useState(defaultImages);

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
      setBubble(bubbleFromNotice(result.message));
    }
  }

  useEffect(() => {
    window.clinePet?.onPetStatus((payload) => {
      setStatus(payload.status);
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
        onStartChat={() => setChatOpen(true)}
        onChatSubmit={sendChat}
        onChatCancel={() => setChatOpen(false)}
        onDiagnose={() => {
          const text = `status=${status}\nvisibleStatus=${visibleStatus}`;
          setDiagnostics(text);
          setBubble(bubbleFromDiagnostics("诊断信息已打开。"));
        }}
      />
      <DiagnosticsPanel text={diagnostics} onClose={() => setDiagnostics("")} />
    </>
  );
}