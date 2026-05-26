export const ERROR_CODES = {
  PET_APP_UNREACHABLE: "PET_APP_UNREACHABLE",
  BRIDGE_UNREACHABLE: "BRIDGE_UNREACHABLE",
  INVALID_STATUS: "INVALID_STATUS",
  INVALID_PET_PACK: "INVALID_PET_PACK",
  TIMEOUT: "TIMEOUT",
  INTERNAL_ERROR: "INTERNAL_ERROR"
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: ErrorCode; message: string; details?: Record<string, unknown> };

export function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(errorCode: ErrorCode, message: string, details?: Record<string, unknown>): ToolResult<T> {
  return { ok: false, errorCode, message, details };
}