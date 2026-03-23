import {
  ownerFromUrn,
  safeParse,
  nameFromUrn,
} from "./asset-base.js";
import type { DotAssetKind, ParseResult } from "./asset-base.js";
import { parseActAsset } from "./act.js";
import type { ActAssetV1 } from "./act.js";
import { parseDanceAsset } from "./dance.js";
import type { DanceAssetV1 } from "./dance.js";
import { parsePerformerAsset } from "./performer.js";
import type { PerformerAssetV1 } from "./performer.js";
import { parseTalAsset } from "./tal.js";
import type { TalAssetV1 } from "./tal.js";

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
  owner: string;
  name: string;
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
    owner: ownerFromUrn(asset.urn),
    name: nameFromUrn(asset.urn),
    tags: asset.tags || [],
  };
}
