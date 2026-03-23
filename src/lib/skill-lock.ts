/**
 * Manages .dance-of-tal/skill-lock.json — tracks installed Dance skills.
 *
 * Example:
 * {
 *   "version": 1,
 *   "skills": {
 *     "dance/@acme/frontend-skills/code-review": {
 *       "source": "github",
 *       "sourceUrl": "https://github.com/acme/frontend-skills",
 *       "skillPath": "skills/code-review",
 *       "skillFolderHash": "abc123...",
 *       "installedAt": "2026-03-20T...",
 *       "updatedAt": "2026-03-20T..."
 *     }
 *   }
 * }
 */
import fs from "fs/promises";
import path from "path";
import { getDotDir } from "./registry.js";

export interface SkillLockEntry {
    source: "github";     // source type
    sourceUrl: string;    // e.g. https://github.com/acme/frontend-skills
    skillPath: string;    // relative path in repo
    skillFolderHash?: string; // GitHub tree SHA for update detection
    installedAt: string;  // ISO timestamp
    updatedAt: string;    // ISO timestamp
}

export interface SkillLock {
    version: 1;
    skills: Record<string, SkillLockEntry>;
}

const LOCK_FILE = "skill-lock.json";

function lockFilePath(cwd: string): string {
    return path.join(getDotDir(cwd), LOCK_FILE);
}

/**
 * Reads the skill lock file. Returns empty lock if not found.
 */
export async function readSkillLock(cwd: string): Promise<SkillLock> {
    try {
        const raw = await fs.readFile(lockFilePath(cwd), "utf-8");
        const data = JSON.parse(raw);
        if (data?.version === 1 && typeof data.skills === "object") {
            return data as SkillLock;
        }
    } catch {
        // Not found or invalid — return empty
    }
    return { version: 1, skills: {} };
}

/**
 * Writes the skill lock file.
 */
export async function writeSkillLock(cwd: string, lock: SkillLock): Promise<void> {
    const filePath = lockFilePath(cwd);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(lock, null, 2), "utf-8");
}

/**
 * Adds or updates a skill entry in the lock file.
 */
export async function upsertSkillLockEntry(
    cwd: string,
    urn: string,
    entry: Omit<SkillLockEntry, "installedAt" | "updatedAt">,
): Promise<void> {
    const lock = await readSkillLock(cwd);
    const now = new Date().toISOString();

    const existing = lock.skills[urn];
    lock.skills[urn] = {
        ...entry,
        installedAt: existing?.installedAt ?? now,
        updatedAt: now,
    };

    await writeSkillLock(cwd, lock);
}

/**
 * Removes a skill entry from the lock file.
 */
export async function removeSkillLockEntry(cwd: string, urn: string): Promise<void> {
    const lock = await readSkillLock(cwd);
    delete lock.skills[urn];
    await writeSkillLock(cwd, lock);
}

/**
 * Returns all installed skill URNs.
 */
export async function listLockedSkills(cwd: string): Promise<string[]> {
    const lock = await readSkillLock(cwd);
    return Object.keys(lock.skills);
}
