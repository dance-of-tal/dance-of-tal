export const DOT_ASSET_KINDS = ['tal', 'dance', 'performer', 'act'] as const;

export type DotAssetKind = (typeof DOT_ASSET_KINDS)[number];

/**
 * Base shape for all canonical assets.
 * No $schema field — schema URLs are legacy.
 */
export type DotAssetBase<K extends DotAssetKind, P> = {
  kind: K;
  urn: string;
  description?: string;
  tags?: string[];
  payload: P;
};

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Parsed 4-segment URN: kind/@owner/stage/name
 */
export type ParsedUrn<K extends DotAssetKind = DotAssetKind> = {
  kind: K;
  owner: string;
  stage: string;
  name: string;
};

/**
 * 4-segment URN regex: kind/@owner/stage/name
 * - kind: tal|dance|performer|act
 * - owner: @[A-Za-z0-9_-]+
 * - stage: [A-Za-z0-9][A-Za-z0-9._-]*
 * - name: [A-Za-z0-9][A-Za-z0-9._-]*
 */
const URN_RE =
  /^(tal|dance|performer|act)\/@[A-Za-z0-9_-]+\/[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function asOptionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error("must be a string when provided");
  }
  return value;
}

export function asOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings when provided`);
  }
  const result = value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${fieldName}[${index}] must be a string`);
    }
    return item;
  });
  return Array.from(new Set(result));
}

/**
 * Parses and validates a 4-segment URN: kind/@owner/stage/name
 */
export function parseDotAssetUrn(
  urn: unknown,
  expectedKind?: DotAssetKind,
): ParsedUrn {
  if (!isNonEmptyString(urn)) {
    throw new Error("urn must be a non-empty string");
  }
  if (!URN_RE.test(urn)) {
    throw new Error("urn must match '<kind>/@<owner>/<stage>/<name>'");
  }

  const [kind, rawOwner, stage, name] = urn.split("/");
  if (!isDotAssetKind(kind)) {
    throw new Error(`unsupported asset kind '${kind}'`);
  }
  if (expectedKind && kind !== expectedKind) {
    throw new Error(`urn kind must be '${expectedKind}'`);
  }

  return {
    kind: kind as typeof expectedKind extends DotAssetKind ? typeof expectedKind : DotAssetKind,
    owner: rawOwner.slice(1), // remove @ prefix
    stage,
    name,
  };
}

export function nameFromUrn(urn: string): string {
  return parseDotAssetUrn(urn).name;
}

export function stageFromUrn(urn: string): string {
  return parseDotAssetUrn(urn).stage;
}

export function ownerFromUrn(urn: string): string {
  return `@${parseDotAssetUrn(urn).owner}`;
}

/**
 * @deprecated Use nameFromUrn instead. Kept for backward compat during transition.
 */
export function slugFromUrn(urn: string): string {
  return nameFromUrn(urn);
}

/**
 * @deprecated Use ownerFromUrn instead. Kept for backward compat during transition.
 */
export function authorFromUrn(urn: string): string {
  return ownerFromUrn(urn);
}

export function isDotAssetKind(value: string): value is DotAssetKind {
  return (DOT_ASSET_KINDS as readonly string[]).includes(value);
}

/**
 * Validates the base shape of a canonical asset.
 * No $schema validation — schema URLs are removed.
 */
export function assertBaseAssetShape<K extends DotAssetKind>(
  input: unknown,
  kind: K,
): DotAssetBase<K, Record<string, unknown>> {
  if (!isRecord(input)) {
    throw new Error("asset must be an object");
  }
  if (input.kind !== kind) {
    throw new Error(`kind must be '${kind}'`);
  }

  const parsedUrn = parseDotAssetUrn(input.urn, kind);

  if (input.description !== undefined && typeof input.description !== "string") {
    throw new Error("description must be a string when provided");
  }

  const tags = asOptionalStringArray(input.tags, "tags");
  if (!isRecord(input.payload)) {
    throw new Error("payload must be an object");
  }

  return {
    kind,
    urn: `${parsedUrn.kind}/@${parsedUrn.owner}/${parsedUrn.stage}/${parsedUrn.name}`,
    ...(typeof input.description === "string" ? { description: input.description } : {}),
    ...(tags ? { tags } : {}),
    payload: input.payload,
  };
}

export function safeParse<T>(fn: () => T): ParseResult<T> {
  try {
    return { success: true, data: fn() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown parse error",
    };
  }
}
