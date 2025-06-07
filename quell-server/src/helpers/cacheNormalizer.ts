// src/helpers/cacheNormalizer.ts
import { ResponseDataType, ProtoObjType, QueryMapType } from "../types/types";
import { getCacheID } from "./cacheUtils";

export function normalizeNode(
  key: string,
  value: any,
  proto: ProtoObjType,
  parentName: string,
  map: QueryMapType
): { cacheID: string; payload: object } {
  const cacheID = getCacheID(proto, map);
  const payload: Record<string, any> = {};

  for (const field in value) {
    if (field.includes("__")) continue;
    payload[field] = value[field];
  }

  return { cacheID, payload };
}
