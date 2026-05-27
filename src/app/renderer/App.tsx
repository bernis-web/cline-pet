import { useEffect, useState } from "react";
import { PetStatus } from "../../shared/statuses";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { PetView } from "./PetView";
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
  const [task, setTask] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [diagnostics, setDiagnostics] = useState("");
  const [images, setImages] = useState(defaultImages);
  useEffect(() => {
    window.clinePet?.onPetStatus((payload) => {
      setStatus(payload.status);
      setVisibleStatus(payload.visibleStatus ?? payload.status);
      setTask(payload.task ?? "");
      setUpdatedAt(payload.updatedAt ?? "");
    });
    window.clinePet?.onPetPack((payload) => setImages({ ...defaultImages, ...payload.stateImages }));
  }, []);
  return <><PetView status={visibleStatus} task={task} updatedAt={updatedAt} imageSrc={images[visibleStatus] ?? defaultImages.idle} onDiagnose={() => setDiagnostics(`status=${status}\nvisibleStatus=${visibleStatus}\ntask=${task}\nupdatedAt=${updatedAt}`)}/><DiagnosticsPanel text={diagnostics} onClose={() => setDiagnostics("")}/></>;
}
