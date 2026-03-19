export const DOT_ASSET_KINDS = ['tal', 'dance', 'performer', 'act'] as const;

export type DotAssetKind = (typeof DOT_ASSET_KINDS)[number];

export type DotAssetSchemaMap = {
  tal: "https://schemas.danceoftal.com/assets/tal.v1.json";
  dance: "https://schemas.danceoftal.com/assets/dance.v1.json";
  performer: "https://schemas.danceoftal.com/assets/performer.v1.json";
  act: "https://schemas.danceoftal.com/assets/act.v1.json";
};

export type DotAssetSchema<K extends DotAssetKind> = DotAssetSchemaMap[K];

export type DotAssetBase<K extends DotAssetKind, P> = {
  $schema: DotAssetSchema<K>;
  kind: K;
  urn: string;
  description?: string;
  tags?: string[];
  payload: P;
};

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ParsedUrn<K extends DotAssetKind = DotAssetKind> = {
  kind: K;
  author: string;
  slug: string;
};

const URN_RE =
  /^(tal|dance|performer|act)\/@[A-Za-z0-9_-]+\/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;

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

export function parseDotAssetUrn(
  urn: unknown,
  expectedKind?: DotAssetKind,
): ParsedUrn {
  if (!isNonEmptyString(urn)) {
    throw new Error("urn must be a non-empty string");
  }
  if (!URN_RE.test(urn)) {
    throw new Error("urn must match '<kind>/@<author>/<slug>'");
  }

  const [kind, author, slug] = urn.split("/");
  if (!isDotAssetKind(kind)) {
    throw new Error(`unsupported asset kind '${kind}'`);
  }
  if (expectedKind && kind !== expectedKind) {
    throw new Error(`urn kind must be '${expectedKind}'`);
  }

  return {
    kind: kind as typeof expectedKind extends DotAssetKind ? typeof expectedKind : DotAssetKind,
    author: author.slice(1),
    slug,
  };
}

export function slugFromUrn(urn: string): string {
  return parseDotAssetUrn(urn).slug;
}

export function authorFromUrn(urn: string): string {
  return `@${parseDotAssetUrn(urn).author}`;
}

export function isDotAssetKind(value: string): value is DotAssetKind {
  return (DOT_ASSET_KINDS as readonly string[]).includes(value);
}

export function assertBaseAssetShape<K extends DotAssetKind>(
  input: unknown,
  kind: K,
  schema: DotAssetSchema<K>,
): DotAssetBase<K, Record<string, unknown>> {
  if (!isRecord(input)) {
    throw new Error("asset must be an object");
  }
  if (input.$schema !== schema) {
    throw new Error(`$schema must be '${schema}'`);
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
    $schema: schema,
    kind,
    urn: `${parsedUrn.kind}/@${parsedUrn.author}/${parsedUrn.slug}`,
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
