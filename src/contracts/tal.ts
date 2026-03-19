import {
  assertBaseAssetShape,
  DotAssetBase,
  ParseResult,
  safeParse,
  asOptionalStringArray,
  isNonEmptyString,
} from "./asset-base.js";

export const TAL_ASSET_SCHEMA =
  "https://schemas.danceoftal.com/assets/tal.v1.json" as const;

export type TalAssetPayloadV1 = {
  content: string;
};

export type TalAssetV1 = DotAssetBase<"tal", TalAssetPayloadV1>;

export function parseTalAsset(input: unknown): TalAssetV1 {
  const base = assertBaseAssetShape(input, "tal", TAL_ASSET_SCHEMA);

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
