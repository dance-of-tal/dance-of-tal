import fs from "fs/promises";
import fss from "fs";
import path from "path";
import os from "os";
import {
    assertPathInside,
    assertSafeAssetUrn,
} from "./identifiers.js";

/**
 * Returns the root `.dance-of-tal` directory for the active project.
 * Always local to the project — enforces multi-agent isolation.
 */
export function getDotDir(cwd: string = process.cwd()): string {
    return path.join(cwd, ".dance-of-tal");
}

/**
 * Returns the parent directory for global assets.
 * Respects DANCE_OF_TAL_HOME env var, falls back to os.homedir().
 * Use getDotDir(getGlobalCwd()) to get the full .dance-of-tal path.
 */
export function getGlobalCwd(): string {
    const rawInput = process.env.DANCE_OF_TAL_HOME?.trim() || os.homedir();
    const normalized = path.resolve(rawInput);
    // Guard against double-nesting: if user sets DANCE_OF_TAL_HOME to the .dance-of-tal dir itself
    return path.basename(normalized) === ".dance-of-tal"
        ? path.dirname(normalized)
        : normalized;
}

/**
 * Returns the global `.dance-of-tal` directory (full path).
 * Convenience wrapper: getDotDir(getGlobalCwd()).
 */
export function getGlobalDotDir(): string {
    return getDotDir(getGlobalCwd());
}

/**
 * Ensures the .dance-of-tal workspace exists at the given cwd.
 * Auto-initializes if missing (like npm auto-creating node_modules).
 */
export async function ensureDotDir(cwd: string): Promise<void> {
    const dotDir = getDotDir(cwd);
    if (!fss.existsSync(dotDir)) {
        await initRegistry(cwd);
    }
}

/**
 * Resolves the on-disk path for an installed asset from its URN.
 *
 * URN structure:  <kind>/@<author>/<name>
 * File structure: .dance-of-tal/assets/<kind>/@<author>/<name>.json
 *
 * Example:
 *   tal/@acme/system-architect
 *   → .dance-of-tal/assets/tal/@acme/system-architect.json
 */
export function assetFilePath(cwd: string, urn: string): string {
    assertSafeAssetUrn(urn);
    const [kind, author, name] = urn.split("/");
    const dotDir = path.resolve(getDotDir(cwd));
    const filePath = path.resolve(dotDir, "assets", kind, author, `${name}.json`);
    assertPathInside(dotDir, filePath, "asset");
    return filePath;
}

/**
 * Reads a locally installed asset by URN, returns the parsed JSON.
 * Checks local (project) first, then falls back to global.
 * Returns null if not found in either location.
 */
export async function readAsset(cwd: string, urn: string): Promise<Record<string, unknown> | null> {
    // Try local first
    const localPath = assetFilePath(cwd, urn);
    try {
        const raw = await fs.readFile(localPath, "utf-8");
        return JSON.parse(raw);
    } catch (err: any) {
        if (err.code !== "ENOENT") throw err;
    }

    // Fallback to global
    const globalCwd = getGlobalCwd();
    if (globalCwd !== cwd) {
        const globalPath = assetFilePath(globalCwd, urn);
        try {
            const raw = await fs.readFile(globalPath, "utf-8");
            return JSON.parse(raw);
        } catch (err: any) {
            if (err.code !== "ENOENT") throw err;
        }
    }

    return null;
}

/**
 * Extracts just the content (prompt text) from a tal or dance asset.
 * Returns null if asset not found or has no content field.
 *
 * Example:
 *   await getAssetPayload(cwd, "tal/@acme/system-architect")
 *   → "You are a senior system architect..."
 */
export async function getAssetPayload(cwd: string, urn: string): Promise<string | null> {
    const asset = await readAsset(cwd, urn);
    if (!asset) return null;
    return (
        typeof asset.payload === "object"
        && asset.payload !== null
        && typeof (asset.payload as Record<string, unknown>).content === "string"
    )
        ? ((asset.payload as Record<string, unknown>).content as string)
        : null;
}

/**
 * Ensures the workspace filesystem layout exists.
 * Creates all asset-kind directories.
 */
export async function initRegistry(cwd: string = process.cwd()): Promise<void> {
    const dotDir = getDotDir(cwd);

    await fs.mkdir(dotDir, { recursive: true });

    await fs.writeFile(
        path.join(dotDir, "dot.json"),
        JSON.stringify({ schema: "dot.workspace/v1", version: 1 }, null, 2),
        "utf-8",
    ).catch(() => undefined);

    // Create directories for every asset kind
    for (const kind of ["tal", "dance", "act", "performer"]) {
        await fs.mkdir(path.join(dotDir, "assets", kind), { recursive: true });
    }

    // Create drafts directory with per-kind subdirectories
    for (const kind of ["tal", "dance", "act", "performer"]) {
        await fs.mkdir(path.join(dotDir, "drafts", kind), { recursive: true });
    }
}
