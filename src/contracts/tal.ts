import {
  assertBaseAssetShape,
  safeParse,
  isNonEmptyString,
} from "./asset-base.js";
import type { DotAssetBase, ParseResult } from "./asset-base.js";

export type TalAssetPayloadV1 = {
  content: string;
};

export type TalAssetV1 = DotAssetBase<"tal", TalAssetPayloadV1>;

export function parseTalAsset(input: unknown): TalAssetV1 {
  const base = assertBaseAssetShape(input, "tal");

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

export function safeParseTalAsset(input: unknown): ParseResult<TalAssetV1> {
  return safeParse(() => parseTalAsset(input));
}
