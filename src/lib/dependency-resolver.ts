import fs from "fs";
import { assetFilePath } from "./registry.js";
import { parseActAsset, parsePerformerAsset } from "../contracts/index.js";
import { installAsset } from "./installer.js";
import type { InstalledAsset } from "./installer.js";

export interface InstallPerformerResult {
    performerUrn: string;
    installedAssets: InstalledAsset[];
}

export interface InstallActResult {
    actUrn: string;
    actAsset: InstalledAsset;
    installedAssets: InstalledAsset[];
}

/**
 * Installs a performer and ALL its dependencies (tal, dances).
 */
export async function installPerformerWithDeps(
    cwd: string,
    performerUrn: string,
    force = false
): Promise<InstallPerformerResult> {
    const parts = performerUrn.split("/");
    if (parts.length !== 4 || parts[0] !== "performer" || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid performer URN: '${performerUrn}'. Expected: performer/@<owner>/<stage>/<name>`
        );
    }

    const installed: InstalledAsset[] = [];

    const performerAsset = await installAsset(cwd, performerUrn, force);
    installed.push(performerAsset);

    const filePath = assetFilePath(cwd, performerUrn);
    const content = parsePerformerAsset(
        JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>
    );

    if (content.payload.tal) {
        installed.push(await installAsset(cwd, content.payload.tal, force));
    }

    for (const danceUrn of content.payload.dances || []) {
        installed.push(await installAsset(cwd, danceUrn, force));
    }

    return { performerUrn, installedAssets: installed };
}

/**
 * Installs an act and recursively installs all referenced performer dependencies
 * (including each performer's tal and dance dependencies).
 */
export async function installActWithDependencies(
    cwd: string,
    actUrn: string,
    force = false
): Promise<InstallActResult> {
    const parts = actUrn.split("/");
    if (parts.length !== 4 || parts[0] !== "act" || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid act URN: '${actUrn}'. Expected: act/@<owner>/<stage>/<name>`
        );
    }

    const installed: InstalledAsset[] = [];
    const seen = new Set<string>();

    const markInstalled = (asset: InstalledAsset) => {
        if (seen.has(asset.urn)) return;
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
            // Install performer with all its dependencies (tal, dances)
            const result = await installPerformerWithDeps(cwd, performerUrn, force);
            for (const asset of result.installedAssets) {
                markInstalled(asset);
            }
        }
    }

    return { actUrn, actAsset, installedAssets: installed };
}
