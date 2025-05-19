// src/helpers/cacheUtils.ts
import { ProtoObjType, QueryMapType } from "../types";

export function getCacheID(proto: ProtoObjType, map: QueryMapType): string {
  const base = map[proto.__type as string] ?? proto.__type;
  return proto.__id ? `${base}--${proto.__id}` : String(base);
}
