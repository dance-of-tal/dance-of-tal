import {
  assertBaseAssetShape,
  safeParse,
  isNonEmptyString,
} from "./asset-base.js";
import type { DotAssetBase, ParseResult } from "./asset-base.js";

export const DANCE_ASSET_SCHEMA =
  "https://schemas.danceoftal.com/assets/dance.v1.json" as const;

export type DanceAssetPayloadV1 = {
  content: string;
};

export type DanceAssetV1 = DotAssetBase<"dance", DanceAssetPayloadV1>;

export function parseDanceAsset(input: unknown): DanceAssetV1 {
  const base = assertBaseAssetShape(input, "dance", DANCE_ASSET_SCHEMA);

  if (!isNonEmptyString(base.payload.content)) {
    throw new Error("payload.content must be a non-empty markdown string");
  }

  return {
    ...base,
    payload: {
      content: base.payload.content,
    },
  };
}

export function safeParseDanceAsset(input: unknown): ParseResult<DanceAssetV1> {
  return safeParse(() => parseDanceAsset(input));
}
