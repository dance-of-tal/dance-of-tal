import {
  safeParse,
  isNonEmptyString,
  parseDotAssetUrn,
} from "./asset-base.js";
import type { DotAssetBase, ParseResult } from "./asset-base.js";
import matter from "gray-matter";

/**
 * Dance = agentskills.io Skill.
 * Parsed from SKILL.md frontmatter (gray-matter), not JSON.
 *
 * Directory structure:
 *   skill-name/
 *   ├── SKILL.md        (required)
 *   ├── scripts/        (optional)
 *   ├── references/     (optional)
 *   └── assets/         (optional)
 */

export type DanceSkillMeta = {
  /** 1-64 chars, lowercase + hyphens, must match parent directory */
  name: string;
  /** 1-1024 chars */
  description: string;
  /** Normalized tags extracted from metadata (tags, tag, keywords, keyword, category) */
  tags: string[];
  /** License identifier or reference */
  license?: string;
  /** Environment requirements (1-500 chars) */
  compatibility?: string;
  /** Key-value extension fields */
  metadata?: Record<string, string>;
  /** Pre-approved tools for agent */
  allowedTools?: string;
  /** Full SKILL.md body (markdown instructions) */
  content: string;
};

export type DanceAssetPayloadV1 = {
  /** SKILL.md frontmatter name */
  name: string;
  /** SKILL.md frontmatter description */
  description: string;
  /** Full SKILL.md body content (markdown) */
  content: string;
  /** Normalized tags from metadata */
  tags: string[];
  /** Optional frontmatter fields */
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string;
};

export type DanceAssetV1 = DotAssetBase<"dance", DanceAssetPayloadV1>;



/**
 * Parses SKILL.md raw content into DanceSkillMeta.
 * Uses gray-matter for YAML frontmatter extraction.
 *
 * Follows agentskills.io lenient validation:
 * - Only `name` and `description` are required (throw if missing)
 * - All other fields: extract if valid type, silently ignore otherwise
 * - Custom/unknown frontmatter fields are tolerated
 */
export function parseDanceFromSkillMd(raw: string): DanceSkillMeta {
  const { data, content } = matter(raw);

  if (!isNonEmptyString(data.name)) {
    throw new Error("SKILL.md frontmatter must include a non-empty 'name' field");
  }
  if (!isNonEmptyString(data.description)) {
    throw new Error("SKILL.md frontmatter must include a non-empty 'description' field");
  }

  const result: DanceSkillMeta = {
    name: data.name as string,
    description: data.description as string,
    content: content.trim(),
    tags: [],
  };

  // Optional fields — extract if valid, ignore otherwise (never throw)
  if (typeof data.license === "string") {
    result.license = data.license;
  }
  if (typeof data.compatibility === "string") {
    result.compatibility = data.compatibility;
  }
  if (typeof data.metadata === "object" && data.metadata !== null && !Array.isArray(data.metadata)) {
    result.metadata = data.metadata as Record<string, string>;
  }

  // Extract tags from metadata
  result.tags = extractTags(data.metadata as Record<string, unknown> | undefined);

  // allowed-tools: accept string (spec) or array (common in practice)
  if (typeof data["allowed-tools"] === "string") {
    result.allowedTools = data["allowed-tools"];
  } else if (Array.isArray(data["allowed-tools"])) {
    const items = (data["allowed-tools"] as unknown[]).filter(
      (v): v is string => typeof v === "string",
    );
    if (items.length > 0) result.allowedTools = items.join(", ");
  }

  return result;
}

/**
 * Extracts and normalizes tags from metadata fields.
 * Looks for: tags, tag, keywords, keyword, category
 * Accepts: string (comma-separated), string[], or single string
 */
export function extractTags(metadata?: Record<string, unknown>): string[] {
  if (!metadata) return [];

  const tagFields = ["tags", "tag", "keywords", "keyword", "category"];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const field of tagFields) {
    const value = metadata[field];
    if (!value) continue;

    let items: string[];
    if (Array.isArray(value)) {
      items = value.filter((v): v is string => typeof v === "string");
    } else if (typeof value === "string") {
      items = value.split(",").map(s => s.trim()).filter(Boolean);
    } else {
      continue;
    }

    for (const item of items) {
      const normalized = item.toLowerCase().trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
  }

  return result;
}

/**
 * Parses a Dance asset from a full asset object (for Tal/Performer/Act consistency).
 * Dance assets stored locally still use the DotAssetBase shape wrapper,
 * but the payload contains SKILL.md-derived fields.
 */
export function parseDanceAsset(input: unknown): DanceAssetV1 {
  if (typeof input !== "object" || input === null) {
    throw new Error("asset must be an object");
  }
  const obj = input as Record<string, unknown>;
  if (obj.kind !== "dance") {
    throw new Error("kind must be 'dance'");
  }
  if (!isNonEmptyString(obj.urn)) {
    throw new Error("urn must be a non-empty string");
  }

  const parsedUrn = parseDotAssetUrn(obj.urn, "dance");

  if (typeof obj.payload !== "object" || obj.payload === null) {
    throw new Error("payload must be an object");
  }
  const payload = obj.payload as Record<string, unknown>;

  if (!isNonEmptyString(payload.name)) {
    throw new Error("payload.name must be a non-empty string");
  }
  if (!isNonEmptyString(payload.description)) {
    throw new Error("payload.description must be a non-empty string");
  }
  if (!isNonEmptyString(payload.content)) {
    throw new Error("payload.content must be a non-empty string");
  }

  return {
    kind: "dance",
    urn: `${parsedUrn.kind}/@${parsedUrn.owner}/${parsedUrn.stage}/${parsedUrn.name}`,
    ...(typeof obj.description === "string" ? { description: obj.description } : {}),
    ...(Array.isArray(obj.tags) ? { tags: obj.tags as string[] } : {}),
    payload: {
      name: payload.name as string,
      description: payload.description as string,
      content: payload.content as string,
      tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : [],
      ...(typeof payload.license === "string" ? { license: payload.license } : {}),
      ...(typeof payload.compatibility === "string" ? { compatibility: payload.compatibility } : {}),
      ...(typeof payload.metadata === "object" && payload.metadata !== null
        ? { metadata: payload.metadata as Record<string, string> }
        : {}),
      ...(typeof payload.allowedTools === "string" ? { allowedTools: payload.allowedTools } : {}),
    },
  };
}

export function safeParseDanceAsset(input: unknown): ParseResult<DanceAssetV1> {
  return safeParse(() => parseDanceAsset(input));
}
