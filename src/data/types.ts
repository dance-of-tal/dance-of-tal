export type {
  ActAssetPayloadV1,
  ActAssetV1 as ActAsset,
  ActParticipantSubscriptionsV1,
  ActParticipantV1,
  ActRelationPermissionsV1,
  ActRelationV1,
  DanceAssetPayloadV1,
  DanceAssetV1 as DanceAsset,
  DotAssetBase,
  DotAssetKind,
  ModelConfigV1,
  PerformerAssetPayloadV1,
  PerformerAssetV1 as PerformerAsset,
  TalAssetPayloadV1,
  TalAssetV1 as TalAsset,
} from "../contracts/index.js";

export type LockedPerformer = {
  name: string;
  description: string;
  tags: string[];
  schema?: string;
  tal?: string;
  dance?: string | string[];
  model?: { provider: string; modelId: string };
  mcp_config?: Record<string, unknown>;
};

/**
 * Backward-compatible alias for the existing DOT runtime lock format.
 * Canonical publishable assets should use `PerformerAsset` from `dot/contracts`.
 */
export type Performer = LockedPerformer;
