import { contextBridge, ipcRenderer } from "electron";
import type { UpdatePetStatusInput } from "../../shared/schemas.js";
import type { PetStatus } from "../../shared/statuses.js";

export type RendererPetPack = {
  id: string;
  name: string;
  stateImages: Record<PetStatus, string>;
};

contextBridge.exposeInMainWorld("clinePet", {
  onPetStatus(callback: (payload: UpdatePetStatusInput) => void) {
    ipcRenderer.on("pet-status", (_event, payload) => callback(payload));
  },
  onPetPack(callback: (payload: RendererPetPack) => void) {
    ipcRenderer.on("pet-pack", (_event, payload) => callback(payload));
  },
  getPetPack() {
    return ipcRenderer.invoke("get-pet-pack") as Promise<RendererPetPack>;
  }
});