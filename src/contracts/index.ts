import {
  authorFromUrn,
  DotAssetKind,
  parseDotAssetUrn,
  ParseResult,
  safeParse,
  slugFromUrn,
} from "./asset-base.js";
import { ActAssetV1, parseActAsset } from "./act.js";
import { DanceAssetV1, parseDanceAsset } from "./dance.js";
import { PerformerAssetV1, parsePerformerAsset } from "./performer.js";
import { TalAssetV1, parseTalAsset } from "./tal.js";

export * from "./asset-base.js";
export * from "./tal.js";
export * from "./dance.js";
export * from "./performer.js";
export * from "./act.js";

export type AnyDotAssetV1 =
  | TalAssetV1
  | DanceAssetV1
  | PerformerAssetV1
  | ActAssetV1;

export type RegistryMetadataProjection = {
  urn: string;
  kind: DotAssetKind;
  author: string;
  slug: string;
  tags: string[];
};

export function parseDotAsset(input: unknown): AnyDotAssetV1 {
  if (typeof input !== "object" || input === null || !("kind" in input)) {
    throw new Error("asset must be an object with a kind field");
  }

  const kind = (input as { kind?: unknown }).kind;
  switch (kind) {
    case "tal":
      return parseTalAsset(input);
    case "dance":
      return parseDanceAsset(input);
    case "performer":
      return parsePerformerAsset(input);
    case "act":
      return parseActAsset(input);
    default:
      throw new Error("kind must be one of: tal, dance, performer, act");
  }
}

export function safeParseDotAsset(input: unknown): ParseResult<AnyDotAssetV1> {
  return safeParse(() => parseDotAsset(input));
}

export function projectRegistryMetadata(
  asset: AnyDotAssetV1,
): RegistryMetadataProjection {
  return {
    urn: asset.urn,
    kind: asset.kind,
    author: authorFromUrn(asset.urn),
    slug: slugFromUrn(asset.urn),
    tags: asset.tags || [],
  };
}
