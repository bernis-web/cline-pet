import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import type { PetStatus } from "../../shared/statuses.js";

export type RendererPetPack = {
  id: string;
  name: string;
  stateImages: Record<PetStatus, string>;
};

export type IpcLike = {
  on(channel: "pet-status", callback: (event: unknown, payload: UpdatePetStatusInput) => void): void;
  on(channel: "pet-pack", callback: (event: unknown, payload: RendererPetPack) => void): void;
  invoke(channel: "get-pet-pack"): Promise<RendererPetPack>;
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
    }
  };
}