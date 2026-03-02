import path from "path";

const COMBO_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ASSET_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const AUTHOR_RE = /^@[A-Za-z0-9_-]{1,64}$/;
const CATEGORY_RE = /^(tal|dance|act|combo)$/;

export function assertSafeComboName(name: string): void {
  if (!COMBO_NAME_RE.test(name)) {
    throw new Error(
      `Invalid combo name '${name}'. Allowed pattern: ${COMBO_NAME_RE.toString()}`
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
    throw new Error(`Invalid URN '${urn}'. Expected: <category>/@<author>/<name>.`);
  }

  const [category, author, name] = parts;

  if (!CATEGORY_RE.test(category)) {
    throw new Error(`Invalid category in URN '${urn}'.`);
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
