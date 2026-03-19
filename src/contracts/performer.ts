import {
  assertBaseAssetShape,
  DotAssetBase,
  ParseResult,
  safeParse,
  isRecord,
  isNonEmptyString,
  parseDotAssetUrn,
} from "./asset-base.js";

export const PERFORMER_ASSET_SCHEMA =
  "https://schemas.danceoftal.com/assets/performer.v1.json" as const;

export type ModelConfigV1 = {
  provider: string;
  modelId: string;
};

export type McpRequirementV1 = {
  key: string;
  preferred?: string[];
  required?: boolean;
};

export type PerformerMcpV1 = {
  requirements: McpRequirementV1[];
};

export type PerformerAssetPayloadV1 = {
  tal?: string;
  dances?: string[];
  model?: ModelConfigV1;
  modelVariant?: string;
  mcp?: PerformerMcpV1;
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

function parseMcpRequirement(input: unknown, index: number): McpRequirementV1 {
  if (!isRecord(input)) {
    throw new Error(`payload.mcp.requirements[${index}] must be an object`);
  }
  if (!isNonEmptyString(input.key)) {
    throw new Error(`payload.mcp.requirements[${index}].key must be a non-empty string`);
  }

  let preferred: string[] | undefined;
  if (input.preferred !== undefined) {
    if (!Array.isArray(input.preferred)) {
      throw new Error(`payload.mcp.requirements[${index}].preferred must be an array of strings`);
    }
    preferred = Array.from(
      new Set(
        input.preferred.map((entry, prefIndex) => {
          if (!isNonEmptyString(entry)) {
            throw new Error(
              `payload.mcp.requirements[${index}].preferred[${prefIndex}] must be a non-empty string`,
            );
          }
          return entry;
        }),
      ),
    );
  }

  if (input.required !== undefined && typeof input.required !== "boolean") {
    throw new Error(`payload.mcp.requirements[${index}].required must be a boolean when provided`);
  }

  return {
    key: input.key,
    ...(preferred ? { preferred } : {}),
    ...(typeof input.required === "boolean" ? { required: input.required } : {}),
  };
}

function parseMcpConfig(input: unknown): PerformerMcpV1 {
  if (!isRecord(input)) {
    throw new Error("payload.mcp must be an object when provided");
  }
  if (!Array.isArray(input.requirements)) {
    throw new Error("payload.mcp.requirements must be an array");
  }

  const requirements = input.requirements.map((entry, index) =>
    parseMcpRequirement(entry, index),
  );

  if (requirements.length === 0) {
    throw new Error("payload.mcp.requirements must contain at least one entry");
  }

  return { requirements };
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

  let mcp: PerformerMcpV1 | undefined;
  if (base.payload.mcp !== undefined) {
    mcp = parseMcpConfig(base.payload.mcp);
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
      ...(mcp ? { mcp } : {}),
    },
  };
}

export function safeParsePerformerAsset(
  input: unknown,
): ParseResult<PerformerAssetV1> {
  return safeParse(() => parsePerformerAsset(input));
}
