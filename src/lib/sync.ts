/**
 * Compares installed skill folder hash with current GitHub tree SHA.
 * Used by `dot check` and `dot update` to detect changes.
 */

import crypto from "crypto";
import { getOwnerRepo } from "./source-parser.js";
import type { SkillLockEntry } from "./skill-lock.js";

export interface UpdateCheckResult {
    urn: string;
    sourceUrl: string;
    currentHash?: string;
    remoteHash?: string;
    hasUpdate: boolean;
    error?: string;
}

/**
 * Extracts { owner, repo } from a GitHub URL using `getOwnerRepo`.
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const ownerRepo = getOwnerRepo(url);
    if (!ownerRepo) return null;
    const [owner, repo] = ownerRepo.split("/");
    return { owner, repo };
}

/**
 * Fetches the tree SHA for a specific path in a GitHub repo.
 * Uses the GitHub Contents API.
 */
export async function getGitHubTreeSha(
    owner: string,
    repo: string,
    ref: string,
    treePath: string,
): Promise<string | null> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${treePath}?ref=${ref}`;

    try {
        const res = await fetch(url, {
            headers: {
                Accept: "application/vnd.github.v3+json",
                ...(process.env.GITHUB_TOKEN
                    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                    : {}),
            },
        });

        if (!res.ok) return null;

        const data = (await res.json()) as any;

        if (Array.isArray(data)) {
            // Create a stable hash from sorted child SHAs
            const childShas = data
                .map((item: any) => item.sha)
                .filter(Boolean)
                .sort()
                .join(",");
            return crypto.createHash("sha256").update(childShas).digest("hex").slice(0, 40);
        }

        return typeof data.sha === "string" ? data.sha : null;
    } catch {
        return null;
    }
}

/**
 * Checks a single skill for available updates.
 */
export async function checkSkillUpdate(
    urn: string,
    entry: SkillLockEntry,
): Promise<UpdateCheckResult> {
    const { sourceUrl, skillPath, skillFolderHash } = entry;

    const parsed = parseGitHubUrl(sourceUrl);
    if (!parsed) {
        return { urn, sourceUrl, hasUpdate: false, error: "Invalid sourceUrl format" };
    }

    try {
        const remoteHash = await getGitHubTreeSha(parsed.owner, parsed.repo, "HEAD", skillPath);

        if (!remoteHash) {
            return {
                urn,
                sourceUrl,
                currentHash: skillFolderHash,
                hasUpdate: false,
                error: "Could not fetch remote hash",
            };
        }

        return {
            urn,
            sourceUrl,
            currentHash: skillFolderHash,
            remoteHash,
            hasUpdate: skillFolderHash !== remoteHash,
        };
    } catch (err) {
        return {
            urn,
            sourceUrl,
            currentHash: skillFolderHash,
            hasUpdate: false,
            error: err instanceof Error ? err.message : "Unknown error",
        };
    }
}

/**
 * Checks all locked skills for updates.
 */
export async function checkAllUpdates(
    skills: Record<string, SkillLockEntry>,
): Promise<UpdateCheckResult[]> {
    const results = await Promise.all(
        Object.entries(skills).map(([urn, entry]) => checkSkillUpdate(urn, entry)),
    );
    return results;
}
