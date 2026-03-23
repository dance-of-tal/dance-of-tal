import { Command } from "commander";
import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";
import { parseSource, getOwnerRepo } from "../../lib/source-parser.js";
import { shallowClone } from "../../lib/git-fetcher.js";
import { discoverSkills } from "../../lib/skills.js";
import { readPluginManifest } from "../../lib/plugin-manifest.js";
import { upsertSkillLockEntry } from "../../lib/skill-lock.js";
import { getGitHubTreeSha } from "../../lib/sync.js";
import { danceAssetDir, ensureDotDir } from "../../lib/registry.js";
import { reportInstall, REGISTRY_URL } from "../../lib/registry-api.js";
import { copySkillDir } from "../../lib/fs-utils.js";

import type { DiscoveredSkill } from "../../lib/skills.js";

interface AddOptions {
    skill?: string;
    all?: boolean;
    list?: boolean;
    stage?: string;
}

/**
 * Auto-registers a Dance asset in the DOT Registry.
 * POST creates new entries; duplicate URNs increment installs.
 */
async function autoRegisterInRegistry(
    urn: string,
    skill: DiscoveredSkill,
    parsed: ReturnType<typeof parseSource>,
): Promise<void> {
    const ownerRepo = getOwnerRepo(parsed.url);

    try {
        const res = await fetch(`${REGISTRY_URL}/assets/dance`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                urn,
                name: skill.name,
                description: skill.description,
                tags: skill.tags,
                resource: {
                    type: "github",
                    repo: ownerRepo,
                    path: skill.relativePath,
                    ref: parsed.ref || "main",
                },
            }),
        });
        // Silently ignore failures — registration is best-effort
        if (!res.ok) return;
    } catch {
        // Network error — skip
    }
}

/**
 * Discovers skills from the repo path and plugin manifest, and applies filtering.
 */
async function discoverAndFilterSkills(
    tempDir: string,
    parsedSource: ReturnType<typeof parseSource>,
    options: AddOptions
): Promise<DiscoveredSkill[]> {
    const searchDir = parsedSource.subpath ? path.join(tempDir, parsedSource.subpath) : tempDir;
    
    let skills = await discoverSkills(searchDir);

    const manifest = await readPluginManifest(tempDir);
    if (manifest && manifest.skills.length > 0) {
        const existingNames = new Set(skills.map(s => s.name));
        for (const entry of manifest.skills) {
            if (existingNames.has(entry.name)) continue;
            const skillDir = path.join(tempDir, entry.path);
            const discovered = await discoverSkills(skillDir);
            skills.push(...discovered.filter(s => !existingNames.has(s.name)));
        }
    }

    // Determine the effective skill filter (--skill flag takes priority over @skillFilter shorthand)
    const effectiveFilter = options.skill || parsedSource.skillFilter;
    if (effectiveFilter) {
        skills = skills.filter(s => s.name === effectiveFilter);
        if (skills.length === 0) {
            throw new Error(`Skill '${effectiveFilter}' not found in ${parsedSource.url}`);
        }
    }

    return skills;
}

/**
 * Handles the actual copying, metadata updates, and registration for an array of skills.
 */
async function installSkillsLocally(
    skills: DiscoveredSkill[],
    parsedSource: ReturnType<typeof parseSource>,
    stage: string
): Promise<void> {
    const cwd = process.cwd();
    await ensureDotDir(cwd);
    
    const owner = parsedSource.owner;

    for (const skill of skills) {
        const urn = `dance/@${owner}/${stage}/${skill.name}`;
        const destDir = danceAssetDir(cwd, urn);
        const srcDir = path.dirname(skill.skillMdPath);

        copySkillDir(srcDir, destDir);

        const skillFolderHash = await getGitHubTreeSha(
            parsedSource.owner,
            parsedSource.repo,
            parsedSource.ref || "HEAD",
            skill.relativePath,
        ).catch(() => undefined);

        await upsertSkillLockEntry(cwd, urn, {
            source: "github",
            sourceUrl: parsedSource.url.replace(/\.git$/, ""),
            skillPath: skill.relativePath,
            ...(skillFolderHash ? { skillFolderHash } : {}),
        });

        await autoRegisterInRegistry(urn, skill, parsedSource);
        await reportInstall(urn);

        console.log(ui.success(`  ✔ ${urn}`));
        console.log(ui.dim(`    ${skill.description}`));
    }
}

export const addCmd = new Command("add")
    .description("Add Dance skills from a GitHub repo (e.g. dot add owner/repo)")
    .argument("<source>", "GitHub shorthand (owner/repo), owner/repo@skill, or GitHub URL")
    .option("--skill <name>", "Install only a specific skill by name")
    .option("--all", "Install all skills without interactive selection")
    .option("--list", "List available skills without installing")
    .option("--stage <stage>", "Override stage name (defaults to repo name)")
    .action(async (source: string, options: AddOptions) => {
        console.log(ui.title("Adding Dance Skills"));

        try {
            const parsed = parseSource(source);
            console.log(ui.dim(`  Source: ${parsed.url}`));

            const owner = parsed.owner;
            const stage = options.stage || parsed.repo;

            console.log(ui.dim("  Cloning repository..."));
            const { tempDir, cleanup } = await shallowClone({ url: parsed.url, ref: parsed.ref });

            try {
                const skills = await discoverAndFilterSkills(tempDir, parsed, options);

                if (skills.length === 0) {
                    console.log(ui.warning("\n  No SKILL.md files found in this repository."));
                    return;
                }

                if (options.list) {
                    console.log(ui.dim(`\n  Found ${skills.length} skill(s):\n`));
                    for (const skill of skills) {
                        const urn = `dance/@${owner}/${stage}/${skill.name}`;
                        console.log(`    ${ui.highlight(urn)}`);
                        console.log(`      ${ui.dim(skill.description)}`);
                        console.log(`      ${ui.dim(`path: ${skill.relativePath}`)}`);
                        console.log("");
                    }
                    return;
                }

                if (skills.length > 1 && !options.all && !options.skill && !parsed.skillFilter) {
                    console.log(ui.dim(`\n  Found ${skills.length} skills. Use --skill <name> to pick one, or --all to install all.\n`));
                    for (const skill of skills) {
                        console.log(`    ${ui.dim("•")} ${skill.name} — ${ui.dim(skill.description)}`);
                    }
                    console.log(ui.dim(`\n  Installing all ${skills.length} skill(s)...\n`));
                }

                await installSkillsLocally(skills, parsed, stage);
                console.log(ui.success(`\n✔ Added ${skills.length} Dance skill(s) from ${source}`));
            } finally {
                await cleanup();
            }

        } catch (err: any) {
            console.error(ui.error(`Add failed: ${err.message}`));
            process.exit(1);
        }
    });
