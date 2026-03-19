import {
  assertBaseAssetShape,
  safeParse,
  isRecord,
  isNonEmptyString,
  parseDotAssetUrn,
} from "./asset-base.js";
import type { DotAssetBase, ParseResult } from "./asset-base.js";

export const PERFORMER_ASSET_SCHEMA =
  "https://schemas.danceoftal.com/assets/performer.v1.json" as const;

export type ModelConfigV1 = {
  provider: string;
  modelId: string;
};

export type PerformerAssetPayloadV1 = {
  tal?: string;
  dances?: string[];
  model?: ModelConfigV1;
  modelVariant?: string;
  mcp_config?: Record<string, unknown>;
};

export type PerformerAssetV1 = DotAssetBase<"performer", PerformerAssetPayloadV1>;

function parseModelConfig(input: unknown): ModelConfigV1 {
  if (!isRecord(input)) {
    throw new Error("payload.model must be an object when provided");
  }
  if (!isNonEmptyString(input.provider)) {
    throw new Error("payload.model.provider must be a non-empty string");
  }
  if (!isNonEmptyString(input.modelId)) {
    throw new Error("payload.model.modelId must be a non-empty string");
  }
  return {
    provider: input.provider,
    modelId: input.modelId,
  };
}

export function parsePerformerAsset(input: unknown): PerformerAssetV1 {
  const base = assertBaseAssetShape(input, "performer", PERFORMER_ASSET_SCHEMA);

  let tal: string | undefined;
  if (base.payload.tal !== undefined) {
    if (!isNonEmptyString(base.payload.tal)) {
      throw new Error("payload.tal must be a non-empty string when provided");
    }
    parseDotAssetUrn(base.payload.tal, "tal");
    tal = base.payload.tal;
  }

  let dances: string[] | undefined;
  if (base.payload.dances !== undefined) {
    if (!Array.isArray(base.payload.dances)) {
      throw new Error("payload.dances must be an array when provided");
    }
    dances = Array.from(
      new Set(
        base.payload.dances.map((entry, index) => {
          try {
            parseDotAssetUrn(entry, "dance");
          } catch (error) {
            const message = error instanceof Error ? error.message : "invalid dance urn";
            throw new Error(`payload.dances[${index}] ${message}`);
          }
          return entry;
        }),
      ),
    );
    if (dances.length === 0) {
      throw new Error("payload.dances must contain at least one dance URN when provided");
    }
  }

  if (!tal && (!dances || dances.length === 0)) {
    throw new Error("payload must include at least one of tal or dances");
  }

  let model: ModelConfigV1 | undefined;
  if (base.payload.model !== undefined) {
    model = parseModelConfig(base.payload.model);
  }

  if (base.payload.modelVariant !== undefined && !isNonEmptyString(base.payload.modelVariant)) {
    throw new Error("payload.modelVariant must be a non-empty string when provided");
  }

  let mcpConfig: Record<string, unknown> | undefined;
  if (base.payload.mcp_config !== undefined) {
    if (!isRecord(base.payload.mcp_config)) {
      throw new Error("payload.mcp_config must be an object when provided");
    }
    mcpConfig = base.payload.mcp_config;
  }

  return {
    ...base,
    payload: {
      ...(tal ? { tal } : {}),
      ...(dances ? { dances } : {}),
      ...(model ? { model } : {}),
      ...(typeof base.payload.modelVariant === "string"
        ? { modelVariant: base.payload.modelVariant }
        : {}),
      ...(mcpConfig ? { mcp_config: mcpConfig } : {}),
    },
  };
}

export function safeParsePerformerAsset(
  input: unknown,
): ParseResult<PerformerAssetV1> {
  return safeParse(() => parsePerformerAsset(input));
}
