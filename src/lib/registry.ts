import fs from "fs/promises";
import path from "path";
import { Tal, Dance, Act, ComboSummary } from "../data/types.js";

/**
 * Returns the root `.dance-of-tal` directory for the active project.
 * Always local to the project — enforces V2 multi-agent isolation.
 */
export function getDotDir(cwd: string = process.cwd()): string {
    return path.join(cwd, ".dance-of-tal");
}

/**
 * Resolves the on-disk path for an installed asset from its URN.
 *
 * URN structure:  <category>/@<author>/<name>
 * File structure: .dance-of-tal/<category>/@<author>/<name>.json
 *
 * Example:
 *   tal/@dot-presets/system-architect
 *   → .dance-of-tal/tal/@dot-presets/system-architect.json
 */
export function assetFilePath(cwd: string, urn: string): string {
    // urn: "tal/@monarchjuno/system-architect"
    const [category, author, name] = urn.split("/");
    if (!category || !author || !name) {
        throw new Error(`Invalid URN for file path resolution: '${urn}'`);
    }
    return path.join(getDotDir(cwd), category, author, `${name}.json`);
}

/**
 * Ensures the V2 filesystem layout exists.
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
    tal: string;            // Full Tal URN — tal/@author/name
    dance: string | string[]; // Single or layered Dance URNs (applied in order)
    act?: string;            // Optional Act URN — act/@author/name
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
    const combosDir = path.join(getDotDir(cwd), "combo");
    await fs.mkdir(combosDir, { recursive: true });
    const filepath = path.join(combosDir, `${name}.json`);
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
    const filepath = path.join(getDotDir(cwd), "combo", `${name}.json`);
    try {
        const raw = await fs.readFile(filepath, "utf-8");
        return JSON.parse(raw) as Combo;
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        throw err;
    }
}
