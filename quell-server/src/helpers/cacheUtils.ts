// src/helpers/cacheUtils.ts
import { ProtoObjType, QueryMapType } from "../types/types";
import { ServerErrorType } from "../types/types";

export function getCacheID(proto: ProtoObjType, map: QueryMapType): string {
  const base = map[proto.__type as string] ?? proto.__type;
  return proto.__id ? `${base}--${proto.__id}` : String(base);
}

export function createServerError(
    log: string,
    status = 400,
    userMessage?: string
  ): ServerErrorType {
    return {
      log,
      status,
      message: {
        err: userMessage ?? "An error occurred. Check server logs.",
      },
    };
  }
  