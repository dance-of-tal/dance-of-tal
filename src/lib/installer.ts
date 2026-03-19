/**
 * Shared core installer — used by both MCP tools and CLI commands.
 *
 * Rules:
 *   - NO console.log / process.exit / argparse here.
 *   - Only fs, fetch, and sibling lib imports.
 */
import fs from "fs";
import path from "path";
import { getDotDir, assetFilePath, lockPerformer, ensureDotDir } from "./registry.js";
import { LockedPerformer } from "../data/types.js";
import { isAssetKind } from "./kinds.js";
import {
    AnyDotAssetV1,
    parseActAsset,
    parseDotAsset,
    parsePerformerAsset,
    slugFromUrn,
} from "../contracts/index.js";

const REGISTRY_URL =
    process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal.workers.dev";

// ── Types ──────────────────────────────────────────────────────────────────

export interface InstalledAsset {
    urn: string;
    filePath: string;
    skipped: boolean; // true = already existed
}

export interface InstallPerformerResult {
    performerUrn: string;
    localName: string;
    lockfilePath: string;
    installedAssets: InstalledAsset[];
}

export interface InstallActResult {
    actUrn: string;
    actAsset: InstalledAsset;
    installedAssets: InstalledAsset[];
}

export interface RegistryPackageDetail extends RegistryPackageMeta {
    payload: Record<string, unknown>;
    stars?: number;
    tier?: string;
}

function splitRegistryUrn(urn: string) {
    const parts = urn.split("/");
    if (parts.length !== 3 || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid URN format: '${urn}'. Expected: <kind>/@<author>/<name>`
        );
    }

    const [kind, author, slug] = parts;
    if (!isAssetKind(kind)) {
        throw new Error(`Invalid kind: '${kind}'. Allowed: tal, dance, act, performer`);
    }

    return { kind, author, slug };
}

async function fetchRegistryPackageRaw(kind: string, author: string, slug: string) {
    const url = `${REGISTRY_URL}/registry/${kind}/${author}/${slug}`;
    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) {
            throw new Error(`Package '${kind}/@${author}/${slug}' not found in registry.`);
        }
        throw new Error(`Registry error: ${res.statusText}`);
    }

    const { success, package: pkgData } = (await res.json()) as any;
    if (!success || !pkgData) {
        throw new Error("Invalid response from registry.");
    }

    return pkgData;
}

function parseRegistryAsset(kind: string, raw: unknown): AnyDotAssetV1 {
    const parsed = parseDotAsset(raw);
    if (parsed.kind !== kind) {
        throw new Error(`Registry payload kind mismatch. Expected '${kind}', received '${parsed.kind}'.`);
    }
    return parsed;
}

// ── Single asset ───────────────────────────────────────────────────────────

/**
 * Fetches an asset from the registry and saves it locally.
 * Returns { urn, filePath, skipped }.
 * Throws on network/validation errors.
 */
export async function installAsset(
    cwd: string,
    urn: string,
    force = false
): Promise<InstalledAsset> {
    const { kind, author, slug } = splitRegistryUrn(urn);

    // Auto-init workspace if missing (supports both local and global installs)
    await ensureDotDir(cwd);

    const filePath = assetFilePath(cwd, urn);

    // Skip if already installed
    if (!force && fs.existsSync(filePath)) {
        return { urn, filePath, skipped: true };
    }

    const pkgData = await fetchRegistryPackageRaw(kind, author.replace(/^@/, ""), slug);
    const asset = parseRegistryAsset(kind, pkgData.payload);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(asset, null, 2));

    return { urn, filePath, skipped: false };
}

// ── Cascading performer install ────────────────────────────────────────────────

/**
 * Installs a performer and ALL its dependencies (tal, dance[], model?),
 * then auto-locks the performer file.
 *
 * Returns { performerUrn, localName, lockfilePath, installedAssets }.
 */
export async function installPerformerAndLock(
    cwd: string,
    performerUrn: string,
    localName?: string,
    force = false
): Promise<InstallPerformerResult> {
    const parts = performerUrn.split("/");
    if (parts.length !== 3 || parts[0] !== "performer" || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid performer URN: '${performerUrn}'. Expected: performer/@<author>/<name>`
        );
    }

    const slug = parts[2];
    const name = localName ?? slug;
    const installed: InstalledAsset[] = [];

    // 1. Fetch and save the performer asset itself
    const performerAsset = await installAsset(cwd, performerUrn, force);
    installed.push(performerAsset);

    // 2. Read the performer content to discover dependencies
    const filePath = assetFilePath(cwd, performerUrn);
    const content = parsePerformerAsset(
        JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>
    );

    // 3. Install tal (if present)
    const talUrn = typeof content.payload.tal === "string" ? content.payload.tal : null;
    if (talUrn) {
        installed.push(await installAsset(cwd, talUrn, force));
    }

    // 4. Install dance(s) (if present)
    const danceUrns: string[] = content.payload.dances || [];
    for (const danceUrn of danceUrns) {
        installed.push(await installAsset(cwd, danceUrn, force));
    }

    // 5. Model (no file to install, just preserved — string or object)
    const modelValue = content.payload.model !== undefined && content.payload.model !== null ? content.payload.model : null;

    // 6. MCP Config (no file to install, just preserved)
    const mcpConfig = content.payload.mcp ? { requirements: content.payload.mcp.requirements } : null;

    // 7. Auto-lock the performer
    const performer: LockedPerformer = {
        name: slug,
        description: typeof content.description === "string" ? content.description : "",
        tags: Array.isArray(content.tags) ? content.tags.filter((t: unknown): t is string => typeof t === "string") : [],
        schema: content.$schema,
        ...(talUrn ? { tal: talUrn } : {}),
        ...(danceUrns.length > 0 ? { dance: danceUrns.length === 1 ? danceUrns[0] : danceUrns } : {}),
        ...(modelValue ? { model: modelValue } : {}),
        ...(mcpConfig ? { mcp_config: mcpConfig } : {}),
    };
    await lockPerformer(cwd, name, performer);

    const lockfilePath = path.resolve(getDotDir(cwd), "performer", `${name}.json`);

    return { performerUrn, localName: name, lockfilePath, installedAssets: installed };
}

/**
 * Installs an act and recursively installs all referenced performer/tal/dance
 * dependencies. This mirrors the richer CLI install behavior so other hosts can
 * share the same semantics without duplicating command-layer logic.
 */
export async function installActWithDependencies(
    cwd: string,
    actUrn: string,
    force = false
): Promise<InstallActResult> {
    const parts = actUrn.split("/");
    if (parts.length !== 3 || parts[0] !== "act" || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid act URN: '${actUrn}'. Expected: act/@<author>/<name>`
        );
    }

    const installed: InstalledAsset[] = [];
    const seen = new Set<string>();

    const markInstalled = (asset: InstalledAsset) => {
        if (seen.has(asset.urn)) {
            return;
        }
        seen.add(asset.urn);
        installed.push(asset);
    };

    const actAsset = await installAsset(cwd, actUrn, force);
    markInstalled(actAsset);

    const filePath = assetFilePath(cwd, actUrn);
    const content = parseActAsset(
        JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>
    );

    const participants = content.payload.participants;
    if (!Array.isArray(participants) || participants.length === 0) {
        return { actUrn, actAsset, installedAssets: installed };
    }

    for (const entry of participants) {
        const performerUrn = entry.performer;
        if (performerUrn && !seen.has(performerUrn)) {
            const performerAsset = await installAsset(cwd, performerUrn, force);
            markInstalled(performerAsset);
        }

        for (const danceUrn of entry.activeDances || []) {
            if (!seen.has(danceUrn)) {
                markInstalled(await installAsset(cwd, danceUrn, force));
            }
        }
    }

    return { actUrn, actAsset, installedAssets: installed };
}

// ── Registry API ──────────────────────────────────────────────────────────

export interface RegistryPackageMeta {
    urn: string;
    kind: string;
    name: string;
    author: string;
    slug: string;
    description: string;
    tags: string[];
    downloads?: number;
    updatedAt?: string;
}

export async function getRegistryPackage(
    kind: string,
    author: string,
    slug: string
): Promise<RegistryPackageDetail> {
    if (!isAssetKind(kind)) {
        throw new Error(`Invalid kind: '${kind}'. Allowed: tal, dance, act, performer`);
    }

    const normalizedAuthor = author.replace(/^@/, "");
    const pkgData = await fetchRegistryPackageRaw(kind, normalizedAuthor, slug);

    return {
        urn: pkgData.urn ?? `${kind}/@${normalizedAuthor}/${slug}`,
        kind: pkgData.kind ?? kind,
        name: pkgData.name ?? slugFromUrn(pkgData.urn ?? `${kind}/@${normalizedAuthor}/${slug}`),
        author: pkgData.author ?? normalizedAuthor,
        slug: pkgData.slug ?? slug,
        description: pkgData.description ?? "",
        tags: pkgData.tags ?? [],
        downloads: pkgData.downloads,
        updatedAt: pkgData.updatedAt,
        stars: pkgData.stars,
        tier: pkgData.tier,
        payload: typeof pkgData.payload === "object" && pkgData.payload ? pkgData.payload : {},
    };
}

/**
 * Searches the registry with a keyword query. Returns matching assets.
 */
export async function searchRegistry(
    query: string,
    options?: { kind?: string; limit?: number }
): Promise<RegistryPackageMeta[]> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (options?.kind) params.set("kind", options.kind);
    params.set("limit", String(options?.limit ?? 20));

    const url = `${REGISTRY_URL}/registry?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Registry search failed: ${res.statusText}`);

    const data = (await res.json()) as any;
    const packages = data.packages ?? data.results ?? [];

    return normalisePackages(packages);
}

/**
 * Lists all packages from the registry, optionally filtered by kind.
 * Returns all packages for the given kinds.
 */
export async function listRegistryPackages(
    options?: { kinds?: string[]; }
): Promise<RegistryPackageMeta[]> {
    const kinds = options?.kinds ?? ["tal", "dance", "act", "performer"];
    const allPackages: RegistryPackageMeta[] = [];

    await Promise.all(
        kinds.map(async (kind) => {
            const url = `${REGISTRY_URL}/registry?kind=${kind}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Registry error for kind '${kind}': ${res.statusText}`);
            const data = (await res.json()) as any;
            const packages = data.packages ?? data.results ?? [];
            allPackages.push(...normalisePackages(packages));
        })
    );

    return allPackages;
}

function normalisePackages(packages: any[]): RegistryPackageMeta[] {
    return packages.filter(Boolean).map((pkg: any) => ({
        urn: pkg.urn ?? `${pkg.kind ?? pkg.type ?? ""}/@${pkg.author ?? ""}/${pkg.slug ?? pkg.name ?? ""}`,
        kind: pkg.kind ?? pkg.type ?? "",
        name: pkg.name ?? "",
        author: pkg.author ?? "",
        slug: pkg.slug ?? pkg.name ?? "",
        description: pkg.description ?? "",
        tags: pkg.tags ?? [],
        downloads: pkg.downloads,
        updatedAt: pkg.updatedAt,
    }));
}
