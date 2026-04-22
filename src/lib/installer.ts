import fs from "fs";
import path from "path";
import { assetFilePath, danceAssetDir, ensureDotDir } from "./registry.js";
import { isAssetKind } from "./kinds.js";
import { parseDotAsset } from "../contracts/index.js";
import type { AnyDotAssetV1 } from "../contracts/index.js";
import { fetchRegistryPackageRaw } from "./registry-api.js";
import type { DanceResource } from "./registry-api.js";
import { shallowClone } from "./git-fetcher.js";
import { copySkillDir } from "./fs-utils.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface InstalledAsset {
    urn: string;
    filePath: string;
    skipped: boolean;
}

function splitRegistryUrn(urn: string) {
    const parts = urn.split("/");
    if (parts.length !== 4 || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid URN format: '${urn}'. Expected: <kind>/@<owner>/<stage>/<name>`
        );
    }

    const [kind, owner, stage, name] = parts;
    if (!isAssetKind(kind)) {
        throw new Error(`Invalid kind: '${kind}'. Allowed: tal, dance, act, performer`);
    }

    return { kind, owner, stage, name };
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
 * For Dance: fetches from GitHub via Registry resource pointer.
 * For others: fetches payload directly from Registry.
 */
export async function installAsset(
    cwd: string,
    urn: string,
    force = false
): Promise<InstalledAsset> {
    const { kind, owner, stage, name } = splitRegistryUrn(urn);

    await ensureDotDir(cwd);

    if (kind === "dance") {
        return installDanceAsset(cwd, urn, owner.replace(/^@/, ""), stage, name, force);
    }

    const filePath = assetFilePath(cwd, urn);

    if (!force && fs.existsSync(filePath)) {
        return { urn, filePath, skipped: true };
    }

    const pkgData = await fetchRegistryPackageRaw(kind, owner.replace(/^@/, ""), stage, name);
    const asset = parseRegistryAsset(kind, pkgData.payload);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(asset, null, 2));

    return { urn, filePath, skipped: false };
}

/**
 * Installs a Dance asset by:
 * 1. Fetching the resource pointer from Registry
 * 2. Shallow-cloning the GitHub repo
 * 3. Copying the full skill directory (SKILL.md + scripts/ + references/ + assets/)
 */
async function installDanceAsset(
    cwd: string,
    urn: string,
    owner: string,
    stage: string,
    name: string,
    force: boolean,
): Promise<InstalledAsset> {
    const targetDir = danceAssetDir(cwd, urn);
    const skillMdPath = path.join(targetDir, "SKILL.md");

    if (!force && fs.existsSync(skillMdPath)) {
        return { urn, filePath: skillMdPath, skipped: true };
    }

    // Fetch resource pointer from Registry
    const pkgData = await fetchRegistryPackageRaw("dance", owner, stage, name);
    const resource = pkgData.resource as DanceResource | undefined;

    if (!resource || resource.type !== "github") {
        throw new Error(
            `Dance '${urn}' has no GitHub resource pointer. ` +
            `Use 'dot add <owner/repo>' to install from GitHub directly.`
        );
    }

    // Shallow-clone the repo and copy the full skill directory bundle
    const repoUrl = `https://github.com/${resource.repo}.git`;
    const ref = resource.ref || "main";
    const { tempDir, cleanup } = await shallowClone({ url: repoUrl, ref });

    try {
        const srcDir = resource.path
            ? path.join(tempDir, resource.path)
            : tempDir;

        if (!fs.existsSync(srcDir)) {
            throw new Error(
                `Skill directory '${resource.path}' not found in repo '${resource.repo}'.`
            );
        }

        // Copy entire skill bundle (SKILL.md + any sibling scripts/, references/, assets/ dirs)
        copySkillDir(srcDir, targetDir, { repoRoot: tempDir });
    } finally {
        await cleanup();
    }

    return { urn, filePath: skillMdPath, skipped: false };
}
