import { useEffect, useState } from "react";
import { PetStatus } from "../../shared/statuses";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { PetView } from "./PetView";
import { bubbleFromDiagnostics, bubbleFromStatus, type BubbleMessage } from "./bubbleTypes";
import idleImage from "../../assets/default-pet/idle.svg";
import thinkingImage from "../../assets/default-pet/thinking.svg";
import workingImage from "../../assets/default-pet/working.svg";
import waitingApprovalImage from "../../assets/default-pet/waiting-approval.svg";
import doneImage from "../../assets/default-pet/done.svg";
import errorImage from "../../assets/default-pet/error.svg";

declare global {
  interface Window {
    clinePet?: {
      onPetStatus(callback: (payload: { status: PetStatus; visibleStatus: PetStatus; baseStatus: PetStatus; overlayStatus: PetStatus | null; task?: string; updatedAt?: string; normalizedFrom?: string }) => void): void;
      onPetPack(callback: (payload: { stateImages: Record<PetStatus, string> }) => void): void;
      getPetPack?(): Promise<{ stateImages: Record<PetStatus, string> }>;
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
  const [diagnostics, setDiagnostics] = useState("");
  const [images, setImages] = useState(defaultImages);
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
  return <><PetView status={visibleStatus} imageSrc={images[visibleStatus] ?? defaultImages.idle} bubble={bubble} onStartChat={() => setBubble({ id: `notice-${Date.now()}`, kind: "notice", text: "聊天输入会在下一步接入。", createdAt: new Date().toISOString(), autoHideMs: 3000 })} onDiagnose={() => { const text = `status=${status}\nvisibleStatus=${visibleStatus}`; setDiagnostics(text); setBubble(bubbleFromDiagnostics("诊断信息已打开。")); }}/><DiagnosticsPanel text={diagnostics} onClose={() => setDiagnostics("")}/></>;
}
