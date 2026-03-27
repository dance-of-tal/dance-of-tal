/**
 * Discovers SKILL.md files in a directory tree.
 * Parses frontmatter to extract skill metadata.
 */
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { extractTags } from "../contracts/dance.js";

export interface DiscoveredSkill {
    /** Frontmatter name field */
    name: string;
    /** Frontmatter description field */
    description: string;
    /** Normalized tags from metadata (tags, tag, keywords, keyword, category) */
    tags: string[];
    /** Absolute path to the SKILL.md file */
    skillMdPath: string;
    /** Relative path from repo root to the skill directory */
    relativePath: string;
    /** Full raw content of SKILL.md */
    rawContent: string;
    /** Optional frontmatter fields */
    license?: string;
    compatibility?: string;
    metadata?: Record<string, string>;
    allowedTools?: string;
}

/**
 * Priority directories to search for SKILL.md files.
 * Checked first before recursive fallback.
 */
const PRIORITY_DIRS = [
    "skills",
    "skills/.curated",
    "skills/.system",
    "agent-skills",
    ".skills",
    "src/skills",
    "lib/skills",
    "packages/skills",
] as const;

/**
 * Discovers all valid SKILL.md files in a directory.
 * 1. Checks priority directories first
 * 2. Checks for plugin manifest (.claude-plugin/marketplace.json)
 * 3. Falls back to recursive search
 */
export async function discoverSkills(rootDir: string): Promise<DiscoveredSkill[]> {
    const skills: DiscoveredSkill[] = [];
    const seen = new Set<string>();

    // 1. Check root for SKILL.md
    const rootSkill = await tryParseSkillMd(rootDir, rootDir);
    if (rootSkill) {
        seen.add(rootSkill.name);
        skills.push(rootSkill);
    }

    // 2. Check priority directories
    for (const dir of PRIORITY_DIRS) {
        const priorityPath = path.join(rootDir, dir);
        const found = await discoverInDir(priorityPath, rootDir, seen);
        skills.push(...found);
    }

    // 3. Always recurse into subdirs to find additional skills (maxDepth=5)
    // The `seen` set prevents duplicates from root / priority-dir discoveries.
    const found = await discoverRecursive(rootDir, rootDir, seen, 0, 5);
    skills.push(...found);

    return skills;
}

async function discoverInDir(
    dir: string,
    rootDir: string,
    seen: Set<string>,
): Promise<DiscoveredSkill[]> {
    const skills: DiscoveredSkill[] = [];

    let entries: string[];
    try {
        entries = await fs.readdir(dir);
    } catch {
        return skills;
    }

    for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = await fs.stat(entryPath).catch(() => null);
        if (!stat?.isDirectory()) continue;

        const skill = await tryParseSkillMd(entryPath, rootDir);
        if (skill && !seen.has(skill.name)) {
            seen.add(skill.name);
            skills.push(skill);
        }
    }

    return skills;
}

async function discoverRecursive(
    dir: string,
    rootDir: string,
    seen: Set<string>,
    depth: number,
    maxDepth: number,
): Promise<DiscoveredSkill[]> {
    if (depth >= maxDepth) return [];
    const skills: DiscoveredSkill[] = [];

    let entries: string[];
    try {
        entries = await fs.readdir(dir);
    } catch {
        return skills;
    }

    // Check for SKILL.md in this directory
    if (entries.includes("SKILL.md")) {
        const skill = await tryParseSkillMd(dir, rootDir);
        if (skill && !seen.has(skill.name)) {
            seen.add(skill.name);
            skills.push(skill);
            return skills; // Don't recurse into skill directories
        }
    }

    // Recurse into subdirectories
    for (const entry of entries) {
        if (entry.startsWith(".") || entry === "node_modules") continue;
        const entryPath = path.join(dir, entry);
        const stat = await fs.stat(entryPath).catch(() => null);
        if (!stat?.isDirectory()) continue;

        const found = await discoverRecursive(entryPath, rootDir, seen, depth + 1, maxDepth);
        skills.push(...found);
    }

    return skills;
}

/**
 * Tries to parse a SKILL.md file in the given directory.
 */
async function tryParseSkillMd(
    dir: string,
    rootDir: string,
): Promise<DiscoveredSkill | null> {
    const skillMdPath = path.join(dir, "SKILL.md");

    let rawContent: string;
    try {
        rawContent = await fs.readFile(skillMdPath, "utf-8");
    } catch {
        return null;
    }

    try {
        const { data } = matter(rawContent);

        if (typeof data.name !== "string" || !data.name.trim()) return null;
        if (typeof data.description !== "string" || !data.description.trim()) return null;

        return {
            name: data.name,
            description: data.description,
            tags: extractTags(data.metadata as Record<string, unknown> | undefined),
            skillMdPath,
            relativePath: path.relative(rootDir, dir),
            rawContent,
            ...(typeof data.license === "string" ? { license: data.license } : {}),
            ...(typeof data.compatibility === "string" ? { compatibility: data.compatibility } : {}),
            ...(typeof data.metadata === "object" && data.metadata !== null
                ? { metadata: data.metadata as Record<string, string> }
                : {}),
            ...(typeof data["allowed-tools"] === "string"
                ? { allowedTools: data["allowed-tools"] }
                : Array.isArray(data["allowed-tools"])
                    ? { allowedTools: (data["allowed-tools"] as unknown[]).filter((v): v is string => typeof v === "string").join(", ") || undefined }
                    : {}),
        };
    } catch {
        return null;
    }
}

