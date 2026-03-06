import fs from "fs/promises";
import fss from "fs";
import path from "path";
import os from "os";
import {
    assertPathInside,
    assertSafeAssetUrn,
    assertSafePerformerName,
} from "./identifiers.js";
import { Performer } from "../data/types.js";

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
    return process.env.DANCE_OF_TAL_HOME || os.homedir();
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
 * Creates all asset-kind directories + runs.
 */
export async function initRegistry(cwd: string = process.cwd()): Promise<void> {
    const dotDir = getDotDir(cwd);

    await fs.mkdir(dotDir, { recursive: true });

    // Create directories for every asset kind
    for (const kind of ["tal", "dance", "act", "performer"]) {
        await fs.mkdir(path.join(dotDir, kind), { recursive: true });
    }

    // Runs directory — execution contexts
    await fs.mkdir(path.join(dotDir, "runs"), { recursive: true });
}

export type LockedPerformerNameList = {
    names: string[];
    skipped: Array<{ file: string; reason: string }>;
};

/**
 * Locks a Performer to disk.
 * File: .dance-of-tal/performer/<name>.json
 */
export async function lockPerformer(
    cwd: string,
    name: string,
    performer: Performer
): Promise<void> {
    assertSafePerformerName(name);
    const performersDir = path.resolve(getDotDir(cwd), "performer");
    await fs.mkdir(performersDir, { recursive: true });
    const filepath = path.resolve(performersDir, `${name}.json`);
    assertPathInside(performersDir, filepath, "performer");
    await fs.writeFile(filepath, JSON.stringify(performer, null, 2), "utf-8");
}

/**
 * Loads a locked Performer from disk.
 * Returns null if the performer does not exist.
 */
export async function getPerformer(
    cwd: string,
    name: string
): Promise<Performer | null> {
    assertSafePerformerName(name);
    const performersDir = path.resolve(getDotDir(cwd), "performer");
    const filepath = path.resolve(performersDir, `${name}.json`);
    assertPathInside(performersDir, filepath, "performer");
    try {
        const raw = await fs.readFile(filepath, "utf-8");
        return JSON.parse(raw) as Performer;
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        throw err;
    }
}

/**
 * Lists top-level locked performer files from `.dance-of-tal/performer/*.json`.
 * Invalid filenames are skipped and returned as warnings.
 */
export async function listLockedPerformerNames(cwd: string): Promise<LockedPerformerNameList> {
    const performersDir = path.resolve(getDotDir(cwd), "performer");

    let entries: Array<{ name: string; isFile: () => boolean }>;
    try {
        entries = await fs.readdir(performersDir, { withFileTypes: true });
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
            assertSafePerformerName(name);
            names.push(name);
        } catch (err: any) {
            skipped.push({ file: entry.name, reason: err.message });
        }
    }

    names.sort((a, b) => a.localeCompare(b));
    return { names, skipped };
}
