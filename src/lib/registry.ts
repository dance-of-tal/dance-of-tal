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
    return path.basename(normalized) === ".dance-of-tal"
        ? path.dirname(normalized)
        : normalized;
}

/**
 * Returns the global `.dance-of-tal` directory (full path).
 */
export function getGlobalDotDir(): string {
    return getDotDir(getGlobalCwd());
}

/**
 * Ensures the .dance-of-tal workspace exists at the given cwd.
 */
export async function ensureDotDir(cwd: string): Promise<void> {
    const dotDir = getDotDir(cwd);
    if (!fss.existsSync(dotDir)) {
        await initRegistry(cwd);
    }
}

/**
 * Resolves the on-disk path for an installed asset from its 4-segment URN.
 *
 * URN structure:  <kind>/@<owner>/<stage>/<name>
 *
 * Dance (directory):
 *   dance/@acme/frontend-skills/code-review
 *   → .dance-of-tal/assets/dance/@acme/frontend-skills/code-review/SKILL.md
 *
 * Tal/Performer/Act (JSON file):
 *   tal/@acme/agent-presets/senior-backend
 *   → .dance-of-tal/assets/tal/@acme/agent-presets/senior-backend.json
 */
export function assetFilePath(cwd: string, urn: string): string {
    assertSafeAssetUrn(urn);
    const [kind, owner, stage, name] = urn.split("/");
    const dotDir = path.resolve(getDotDir(cwd));

    let filePath: string;
    if (kind === "dance") {
        // Dance = directory with SKILL.md
        filePath = path.resolve(dotDir, "assets", kind, owner, stage, name, "SKILL.md");
    } else {
        // Tal/Performer/Act = JSON file
        filePath = path.resolve(dotDir, "assets", kind, owner, stage, `${name}.json`);
    }

    assertPathInside(dotDir, filePath, "asset");
    return filePath;
}

/**
 * Returns the directory path for a Dance skill asset.
 */
export function danceAssetDir(cwd: string, urn: string): string {
    assertSafeAssetUrn(urn);
    const [kind, owner, stage, name] = urn.split("/");
    if (kind !== "dance") {
        throw new Error(`danceAssetDir only works with dance URNs, got '${kind}'`);
    }
    const dotDir = path.resolve(getDotDir(cwd));
    const dirPath = path.resolve(dotDir, "assets", kind, owner, stage, name);
    assertPathInside(dotDir, dirPath, "dance asset");
    return dirPath;
}

/**
 * Reads a locally installed asset by URN.
 * Dance: parses SKILL.md frontmatter.
 * Others: parses JSON file.
 * Returns null if not found.
 */
export async function readAsset(cwd: string, urn: string): Promise<Record<string, unknown> | null> {
    // Try local first
    const result = await readAssetFrom(cwd, urn);
    if (result) return result;

    // Fallback to global
    const globalCwd = getGlobalCwd();
    if (globalCwd !== cwd) {
        return readAssetFrom(globalCwd, urn);
    }

    return null;
}

async function readAssetFrom(cwd: string, urn: string): Promise<Record<string, unknown> | null> {
    const filePath = assetFilePath(cwd, urn);
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        const [kind] = urn.split("/");

        if (kind === "dance") {
            // Dance: SKILL.md → parse frontmatter
            const { parseDanceFromSkillMd } = await import("../contracts/dance.js");
            const meta = parseDanceFromSkillMd(raw);
            return {
                kind: "dance",
                urn,
                description: meta.description,
                payload: {
                    name: meta.name,
                    description: meta.description,
                    content: meta.content,
                    ...(meta.license ? { license: meta.license } : {}),
                    ...(meta.compatibility ? { compatibility: meta.compatibility } : {}),
                    ...(meta.metadata ? { metadata: meta.metadata } : {}),
                    ...(meta.allowedTools ? { allowedTools: meta.allowedTools } : {}),
                },
            };
        }

        return JSON.parse(raw);
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        throw err;
    }
}

/**
 * Extracts just the content (prompt text) from a tal or dance asset.
 * Returns null if asset not found or has no content field.
 */
export async function getAssetPayload(cwd: string, urn: string): Promise<string | null> {
    const [kind] = urn.split("/");

    if (kind === "dance") {
        // Dance: read SKILL.md body directly
        const filePath = assetFilePath(cwd, urn);
        try {
            const raw = await fs.readFile(filePath, "utf-8");
            const { parseDanceFromSkillMd } = await import("../contracts/dance.js");
            return parseDanceFromSkillMd(raw).content;
        } catch {
            return null;
        }
    }

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
