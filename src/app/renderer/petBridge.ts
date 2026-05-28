import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import type { PetStatus } from "../../shared/statuses.js";

export type RendererPetPack = {
  id: string;
  name: string;
  stateImages: Record<PetStatus, string>;
};

export type ChatResponse =
  | { ok: true; text: string }
  | { ok: false; errorCode: string; message: string };

export type IpcLike = {
  on(channel: "pet-status", callback: (event: unknown, payload: UpdatePetStatusInput) => void): void;
  on(channel: "pet-pack", callback: (event: unknown, payload: RendererPetPack) => void): void;
  on(channel: "chat:response", callback: (event: unknown, payload: ChatResponse) => void): void;
  invoke(channel: "get-pet-pack"): Promise<RendererPetPack>;
  invoke(channel: "chat:send", payload: { text: string }): Promise<ChatResponse>;
};

export function createRendererPetBridge(ipc: IpcLike) {
  return {
    onPetStatus(callback: (payload: UpdatePetStatusInput) => void) {
      ipc.on("pet-status", (_event, payload) => callback(payload));
    },
    onPetPack(callback: (payload: RendererPetPack) => void) {
      ipc.on("pet-pack", (_event, payload) => callback(payload));
    },
    getPetPack() {
      return ipc.invoke("get-pet-pack");
    },
    sendChatMessage(text: string) {
      return ipc.invoke("chat:send", { text });
    },
    onChatResponse(callback: (payload: ChatResponse) => void) {
      ipc.on("chat:response", (_event, payload) => callback(payload));
    }
  };
}