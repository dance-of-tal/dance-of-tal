import fs from "fs/promises";
import path from "path";
import os from "os";

// Type configurations and caching
import { Tal, Dance, Act, ComboSummary } from "../data/types.js";

const DEFAULT_GLOBAL_DOT_DIR = path.join(os.homedir(), ".dance-of-tal");

/**
 * Gets the root `.dance-of-tal` directory for the active project or global location
 */
export function getDotDir(cwd: string = process.cwd()): string {
    // Always use the robust local `.dance-of-tal` relative to the project
    const localDir = path.join(cwd, ".dance-of-tal");
    return localDir; // We enforce local project isolation for V2 Multi-Agent Architecture
}

/**
 * Retrieves the `.dance-of-tal/registry` path
 */
export function getRegistryDir(cwd: string = process.cwd()): string {
    return path.join(getDotDir(cwd), "registry");
}

/**
 * Ensures the basic V2 filesystem layout exists
 */
export async function initRegistry(cwd: string = process.cwd()): Promise<void> {
    const dotDir = getDotDir(cwd);
    const registryDir = getRegistryDir(cwd);
    const runsDir = path.join(dotDir, "runs");
    const mailboxDir = path.join(dotDir, "mailbox");
    const actGraphsDir = path.join(dotDir, "act-graphs");

    await fs.mkdir(dotDir, { recursive: true });
    await fs.mkdir(registryDir, { recursive: true });
    await fs.mkdir(runsDir, { recursive: true });
    await fs.mkdir(mailboxDir, { recursive: true });
    await fs.mkdir(actGraphsDir, { recursive: true });
}

export type Combo = {
    tal: string; // The literal Tal URN
    dance: string; // The literal Dance URN
    act?: string; // The optional Act URN
};

/**
 * Registers a new Type-Safe combo configuration into the registry
 */
export async function lockCombo(
    cwd: string,
    name: string,
    combo: Combo
): Promise<void> {
    const registryDir = getRegistryDir(cwd);
    await fs.mkdir(registryDir, { recursive: true }); // Ensure it exists
    const filepath = path.join(registryDir, `combo.${name}.json`);

    await fs.writeFile(filepath, JSON.stringify(combo, null, 2), "utf-8");
}

/**
 * Loads a locked Combo configuration from the registry
 */
export async function getCombo(
    cwd: string,
    name: string
): Promise<Combo | null> {
    const registryDir = getRegistryDir(cwd);
    const filepath = path.join(registryDir, `combo.${name}.json`);

    try {
        const raw = await fs.readFile(filepath, "utf-8");
        return JSON.parse(raw) as Combo;
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        throw err;
    }
}
