import path from "path";
import { isAssetKind } from "./kinds.js";

const PERFORMER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ASSET_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const AUTHOR_RE = /^@[A-Za-z0-9_-]{1,64}$/;

export function assertSafePerformerName(name: string): void {
  if (!PERFORMER_NAME_RE.test(name)) {
    throw new Error(
      `Invalid performer name '${name}'. Allowed pattern: ${PERFORMER_NAME_RE.toString()}`
    );
  }
}

export function assertSafeRunId(runId: string): void {
  if (!RUN_ID_RE.test(runId)) {
    throw new Error(
      `Invalid runId '${runId}'. Allowed pattern: ${RUN_ID_RE.toString()}`
    );
  }
}

export function assertSafeAssetUrn(urn: string): void {
  const parts = urn.split("/");
  if (parts.length !== 3) {
    throw new Error(`Invalid URN '${urn}'. Expected: <kind>/@<author>/<name>.`);
  }

  const [kind, author, name] = parts;

  if (!isAssetKind(kind)) {
    throw new Error(`Invalid kind in URN '${urn}'.`);
  }
  if (!AUTHOR_RE.test(author)) {
    throw new Error(`Invalid author in URN '${urn}'. Expected '@<author>'.`);
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
