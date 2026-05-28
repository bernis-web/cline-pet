import electron from "electron";
import { createRendererPetBridge } from "../renderer/petBridge.js";

const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld("clinePet", createRendererPetBridge(ipcRenderer));