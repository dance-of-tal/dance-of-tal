/**
 * Shared core installer — used by both MCP tools and CLI commands.
 *
 * Rules:
 *   - NO console.log / process.exit / argparse here.
 *   - Only fs, fetch, and sibling lib imports.
 */
import fs from "fs";
import path from "path";
import { getDotDir, assetFilePath, lockCombo, type Combo } from "./registry.js";
import { isAssetKind } from "./kinds.js";

const REGISTRY_URL =
    process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal-v2.workers.dev";

// ── Types ──────────────────────────────────────────────────────────────────

export interface InstalledAsset {
    urn: string;
    filePath: string;
    skipped: boolean; // true = already existed
}

export interface InstallComboResult {
    comboUrn: string;
    localName: string;
    lockfilePath: string;
    installedAssets: InstalledAsset[];
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
    const parts = urn.split("/");
    if (parts.length !== 3 || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid URN format: '${urn}'. Expected: <kind>/@<author>/<name>`
        );
    }

    const [kind] = parts;
    if (!isAssetKind(kind)) {
        throw new Error(`Invalid kind: '${kind}'. Allowed: tal, dance, act, combo`);
    }

    const dotDir = getDotDir(cwd);
    if (!fs.existsSync(dotDir)) {
        throw new Error(
            "Workspace not initialised. Run 'dot init' or use the setup_workspace MCP tool first."
        );
    }

    const filePath = assetFilePath(cwd, urn);

    // Skip if already installed
    if (!force && fs.existsSync(filePath)) {
        return { urn, filePath, skipped: true };
    }

    const url = `${REGISTRY_URL}/registry/${parts[0]}/${parts[1]}/${parts[2]}`;
    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) throw new Error(`Package '${urn}' not found in registry.`);
        throw new Error(`Registry error: ${res.statusText}`);
    }

    const { success, package: pkgData } = (await res.json()) as any;
    if (!success || !pkgData) throw new Error("Invalid response from registry.");

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(pkgData.payload, null, 2));

    return { urn, filePath, skipped: false };
}

// ── Cascading combo install ────────────────────────────────────────────────

/**
 * Installs a combo and ALL its dependencies (tal, dance[], act?),
 * then auto-locks the combo file.
 *
 * Returns { comboUrn, localName, lockfilePath, installedAssets }.
 */
export async function installComboAndLock(
    cwd: string,
    comboUrn: string,
    localName?: string,
    force = false
): Promise<InstallComboResult> {
    const parts = comboUrn.split("/");
    if (parts.length !== 3 || parts[0] !== "combo" || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid combo URN: '${comboUrn}'. Expected: combo/@<author>/<name>`
        );
    }

    const slug = parts[2];
    const name = localName ?? slug;
    const installed: InstalledAsset[] = [];

    // 1. Fetch and save the combo asset itself
    const comboAsset = await installAsset(cwd, comboUrn, force);
    installed.push(comboAsset);

    // 2. Read the combo content to discover dependencies
    const filePath = assetFilePath(cwd, comboUrn);
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;

    // 3. Install tal (if present)
    const talUrn = typeof content.tal === "string" ? content.tal : null;
    if (talUrn) {
        installed.push(await installAsset(cwd, talUrn, force));
    }

    // 4. Install dance(s) (if present)
    const danceRaw = content.dance;
    const danceUrns: string[] = Array.isArray(danceRaw)
        ? (danceRaw as unknown[]).filter((d): d is string => typeof d === "string")
        : typeof danceRaw === "string"
            ? [danceRaw]
            : [];
    for (const danceUrn of danceUrns) {
        installed.push(await installAsset(cwd, danceUrn, force));
    }

    // 5. Install act (if present)
    const actUrn = typeof content.act === "string" ? content.act : null;
    if (actUrn) {
        installed.push(await installAsset(cwd, actUrn, force));
    }

    // 6. Auto-lock the combo
    const combo: Combo = {
        ...(talUrn ? { tal: talUrn } : {}),
        ...(danceUrns.length > 0 ? { dance: danceUrns.length === 1 ? danceUrns[0] : danceUrns } : {}),
        ...(actUrn ? { act: actUrn } : {}),
    };
    await lockCombo(cwd, name, combo);

    const lockfilePath = path.resolve(getDotDir(cwd), "combo", `${name}.json`);

    return { comboUrn, localName: name, lockfilePath, installedAssets: installed };
}

// ── Search ─────────────────────────────────────────────────────────────────

export interface RegistrySearchResult {
    kind: string;
    name: string;
    author: string;
    slug: string;
    description: string;
    tags: string[];
    downloads?: number;
}

/**
 * Searches the registry. Returns matching assets.
 */
export async function searchRegistry(
    query: string,
    options?: { kind?: string; limit?: number }
): Promise<RegistrySearchResult[]> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (options?.kind) params.set("kind", options.kind);
    params.set("limit", String(options?.limit ?? 20));

    const url = `${REGISTRY_URL}/registry?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Registry search failed: ${res.statusText}`);

    const data = (await res.json()) as any;
    const packages = data.packages ?? data.results ?? [];

    return packages.map((pkg: any) => ({
        kind: pkg.kind ?? pkg.type ?? "",
        name: pkg.name ?? "",
        author: pkg.author ?? "",
        slug: pkg.slug ?? pkg.name ?? "",
        description: pkg.description ?? "",
        tags: pkg.tags ?? [],
        downloads: pkg.downloads,
    }));
}
