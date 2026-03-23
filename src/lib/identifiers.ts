import path from "path";
import { isAssetKind } from "./kinds.js";

const ASSET_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const STAGE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const OWNER_RE = /^@[A-Za-z0-9_-]{1,64}$/;


export function assertSafeAssetUrn(urn: string): void {
  const parts = urn.split("/");
  if (parts.length !== 4) {
    throw new Error(`Invalid URN '${urn}'. Expected: <kind>/@<owner>/<stage>/<name>.`);
  }

  const [kind, owner, stage, name] = parts;

  if (!isAssetKind(kind)) {
    throw new Error(`Invalid kind in URN '${urn}'.`);
  }
  if (!OWNER_RE.test(owner)) {
    throw new Error(`Invalid owner in URN '${urn}'. Expected '@<owner>'.`);
  }
  if (!STAGE_RE.test(stage)) {
    throw new Error(`Invalid stage in URN '${urn}'.`);
  }
  if (!ASSET_NAME_RE.test(name)) {
    throw new Error(`Invalid asset name in URN '${urn}'.`);
  }
}

export function assertPathInside(basePath: string, candidatePath: string, label: string): void {
  const base = path.resolve(basePath);
  const candidate = path.resolve(candidatePath);
  if (candidate === base) return;
  if (!candidate.startsWith(`${base}${path.sep}`)) {
    throw new Error(`Unsafe ${label} path resolution attempted.`);
  }
}

/**
 * Sanitizes an arbitrary string into a valid asset name (kebab-case).
 * Used for auto-generating names from directory names, repos, etc.
 */
export function sanitizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 128) || "unnamed";
}
