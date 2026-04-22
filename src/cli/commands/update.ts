import { Command } from "commander";
import path from "path";
import { ui } from "../utils/ui.js";
import { readSkillLock, upsertSkillLockEntry } from "../../lib/skill-lock.js";
import { checkAllUpdates, getGitHubTreeSha } from "../../lib/sync.js";
import { shallowClone } from "../../lib/git-fetcher.js";
import { discoverSkills } from "../../lib/skills.js";
import { danceAssetDir } from "../../lib/registry.js";
import { copySkillDir } from "../../lib/fs-utils.js";
import { getOwnerRepo } from "../../lib/source-parser.js";

/**
 * Extracts owner/repo from a sourceUrl like https://github.com/owner/repo
 * Returns parsed { owner, repo } or null.
 */
function parseSourceUrl(sourceUrl: string): { owner: string; repo: string } | null {
    const ownerRepo = getOwnerRepo(sourceUrl);
    if (!ownerRepo) return null;
    const [owner, repo] = ownerRepo.split("/");
    return { owner, repo };
}

export const updateCmd = new Command("update")
    .description("Update installed Dance skills to latest versions")
    .option("--force", "Update all skills regardless of change detection")
    .action(async (options) => {
        console.log(ui.title("Updating Dance Skills"));

        try {
            const cwd = process.cwd();
            const lock = await readSkillLock(cwd);
            const entries = Object.entries(lock.skills);

            if (entries.length === 0) {
                console.log(ui.dim("\n  No Dance skills installed. Use 'dot add' to install."));
                return;
            }

            // Check which skills have updates
            let toUpdate: Array<{ urn: string; sourceUrl: string; skillPath: string }>;

            if (options.force) {
                toUpdate = entries.map(([urn, entry]) => ({
                    urn,
                    sourceUrl: entry.sourceUrl,
                    skillPath: entry.skillPath,
                }));
            } else {
                console.log(ui.dim(`\n  Checking ${entries.length} skill(s) for updates...\n`));
                const results = await checkAllUpdates(lock.skills);
                toUpdate = results
                    .filter(r => r.hasUpdate)
                    .map(r => ({
                        urn: r.urn,
                        sourceUrl: r.sourceUrl,
                        skillPath: lock.skills[r.urn].skillPath,
                    }));

                if (toUpdate.length === 0) {
                    console.log(ui.success("✔ All skills are up to date."));
                    return;
                }
            }

            console.log(ui.dim(`  Updating ${toUpdate.length} skill(s)...\n`));

            // Group by source URL for efficiency
            const bySource = new Map<string, typeof toUpdate>();
            for (const item of toUpdate) {
                const existing = bySource.get(item.sourceUrl) || [];
                existing.push(item);
                bySource.set(item.sourceUrl, existing);
            }

            let updated = 0;

            for (const [sourceUrl, items] of bySource) {
                const parsed = parseSourceUrl(sourceUrl);
                if (!parsed) {
                    console.log(ui.warning(`  ⚠ Cannot parse source: ${sourceUrl}`));
                    continue;
                }

                const url = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
                console.log(ui.dim(`  Cloning ${parsed.owner}/${parsed.repo}...`));
                const { tempDir, cleanup } = await shallowClone({ url });

                try {
                    for (const item of items) {
                        const skillDir = path.join(tempDir, item.skillPath);
                        const skills = await discoverSkills(skillDir);

                        if (skills.length === 0) {
                            console.log(ui.warning(`  ⚠ ${item.urn} — skill not found at ${item.skillPath}`));
                            continue;
                        }

                        const skill = skills[0];
                        const destDir = danceAssetDir(cwd, item.urn);
                        const srcDir = path.dirname(skill.skillMdPath);

                        copySkillDir(srcDir, destDir, { repoRoot: tempDir });

                        // Update tree SHA
                        const skillFolderHash = await getGitHubTreeSha(
                            parsed.owner,
                            parsed.repo,
                            "HEAD",
                            item.skillPath,
                        ).catch(() => undefined);

                        await upsertSkillLockEntry(cwd, item.urn, {
                            source: "github",
                            sourceUrl,
                            skillPath: item.skillPath,
                            ...(skillFolderHash ? { skillFolderHash } : {}),
                        });

                        console.log(ui.success(`  ✔ ${item.urn}`));
                        updated++;
                    }
                } finally {
                    await cleanup();
                }
            }

            console.log(ui.success(`\n✔ Updated ${updated} skill(s).`));

        } catch (err: any) {
            console.error(ui.error(`Update failed: ${err.message}`));
            process.exit(1);
        }
    });
