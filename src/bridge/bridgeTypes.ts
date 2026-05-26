import type { UpdatePetStatusInput } from "../shared/schemas.js";

export type BridgeConfig = {
  host?: "127.0.0.1";
  port: number;
  timeoutMs: number;
};

export type BridgeStatusPayload = UpdatePetStatusInput;