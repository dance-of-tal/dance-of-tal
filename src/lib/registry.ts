import fs from "fs/promises";
import path from "path";
import {
    assertPathInside,
    assertSafeAssetUrn,
    assertSafeComboName,
} from "./identifiers.js";

/**
 * Returns the root `.dance-of-tal` directory for the active project.
 * Always local to the project — enforces multi-agent isolation.
 */
export function getDotDir(cwd: string = process.cwd()): string {
    return path.join(cwd, ".dance-of-tal");
}

/**
 * Resolves the on-disk path for an installed asset from its URN.
 *
 * URN structure:  <kind>/@<author>/<name>
 * File structure: .dance-of-tal/<kind>/@<author>/<name>.json
 *
 * Example:
 *   tal/@acme/system-architect
 *   → .dance-of-tal/tal/@acme/system-architect.json
 */
export function assetFilePath(cwd: string, urn: string): string {
    assertSafeAssetUrn(urn);
    const [kind, author, name] = urn.split("/");
    const dotDir = path.resolve(getDotDir(cwd));
    const filePath = path.resolve(dotDir, kind, author, `${name}.json`);
    assertPathInside(dotDir, filePath, "asset");
    return filePath;
}

/**
 * Ensures the workspace filesystem layout exists.
 * Only creates folders that are actively used.
 */
export async function initRegistry(cwd: string = process.cwd()): Promise<void> {
    const dotDir = getDotDir(cwd);
    const combosDir = path.join(dotDir, "combo");
    const runsDir = path.join(dotDir, "runs");

    await fs.mkdir(dotDir, { recursive: true });
    await fs.mkdir(combosDir, { recursive: true });
    await fs.mkdir(runsDir, { recursive: true });
}

export type Combo = {
    tal?: string;              // Optional — dance-only combo possible
    dance?: string | string[]; // Optional — tal-only combo possible
    act?: string;              // Optional Act URN — act/@author/name
    // Rule: at least one of tal or dance must be present (enforced at runtime)
};

export type LockedComboNameList = {
    names: string[];
    skipped: Array<{ file: string; reason: string }>;
};

/**
 * Locks a Combo to disk.
 * File: .dance-of-tal/combo/<name>.json
 */
export async function lockCombo(
    cwd: string,
    name: string,
    combo: Combo
): Promise<void> {
    assertSafeComboName(name);
    const combosDir = path.resolve(getDotDir(cwd), "combo");
    await fs.mkdir(combosDir, { recursive: true });
    const filepath = path.resolve(combosDir, `${name}.json`);
    assertPathInside(combosDir, filepath, "combo");
    await fs.writeFile(filepath, JSON.stringify(combo, null, 2), "utf-8");
}

/**
 * Loads a locked Combo from disk.
 * Returns null if the combo does not exist.
 */
export async function getCombo(
    cwd: string,
    name: string
): Promise<Combo | null> {
    assertSafeComboName(name);
    const combosDir = path.resolve(getDotDir(cwd), "combo");
    const filepath = path.resolve(combosDir, `${name}.json`);
    assertPathInside(combosDir, filepath, "combo");
    try {
        const raw = await fs.readFile(filepath, "utf-8");
        return JSON.parse(raw) as Combo;
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        throw err;
    }
}

/**
 * Lists top-level locked combo files from `.dance-of-tal/combo/*.json`.
 * Invalid filenames are skipped and returned as warnings.
 */
export async function listLockedComboNames(cwd: string): Promise<LockedComboNameList> {
    const combosDir = path.resolve(getDotDir(cwd), "combo");

    let entries: Array<{ name: string; isFile: () => boolean }>;
    try {
        entries = await fs.readdir(combosDir, { withFileTypes: true });
    } catch (err: any) {
        if (err.code === "ENOENT") return { names: [], skipped: [] };
        throw err;
    }

    const names: string[] = [];
    const skipped: Array<{ file: string; reason: string }> = [];

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

        const name = entry.name.replace(/\.json$/, "");
        try {
            assertSafeComboName(name);
            names.push(name);
        } catch (err: any) {
            skipped.push({ file: entry.name, reason: err.message });
        }
    }

    names.sort((a, b) => a.localeCompare(b));
    return { names, skipped };
}
