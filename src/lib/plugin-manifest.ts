/**
 * Parses .claude-plugin/marketplace.json for additional skill paths.
 *
 * Real-world format (e.g. phuryn/pm-skills):
 * {
 *   "metadata": { "pluginRoot": "./plugins" },
 *   "plugins": [
 *     { "name": "my-plugin", "source": "./my-plugin", "skills": ["./skills/review"] }
 *   ]
 * }
 */
import fs from "fs/promises";
import path from "path";

export interface PluginManifestSkill {
    name: string;
    path: string;
}

export interface PluginManifest {
    skills: PluginManifestSkill[];
}

/**
 * Tries to read and parse a plugin manifest from a repo root.
 * Returns null if not found or invalid.
 */
export async function readPluginManifest(repoDir: string): Promise<PluginManifest | null> {
    const manifestPath = path.join(repoDir, ".claude-plugin", "marketplace.json");

    let raw: string;
    try {
        raw = await fs.readFile(manifestPath, "utf-8");
    } catch {
        return null;
    }

    try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object") return null;

        const skills: PluginManifestSkill[] = [];

        // Format 1: top-level "skills" array
        if (Array.isArray(data.skills)) {
            for (const entry of data.skills) {
                if (
                    typeof entry === "object" &&
                    entry !== null &&
                    typeof entry.name === "string" &&
                    typeof entry.path === "string"
                ) {
                    skills.push({ name: entry.name, path: entry.path });
                }
            }
        }

        // Format 2: "plugins" array with nested "skills" (phuryn/pm-skills style)
        if (Array.isArray(data.plugins)) {
            for (const plugin of data.plugins) {
                if (typeof plugin !== "object" || plugin === null) continue;
                const pluginSource = typeof plugin.source === "string" ? plugin.source : "";

                if (Array.isArray(plugin.skills)) {
                    for (const skillPath of plugin.skills) {
                        if (typeof skillPath === "string") {
                            // Resolve relative to plugin source
                            const resolvedPath = pluginSource
                                ? path.join(pluginSource, skillPath)
                                : skillPath;
                            const skillName = path.basename(skillPath);
                            skills.push({ name: skillName, path: resolvedPath });
                        }
                    }
                }
            }
        }

        return skills.length > 0 ? { skills } : null;
    } catch {
        return null;
    }
}

/**
 * Gets all skill paths declared in plugin manifests (for discovery).
 * Returns absolute paths resolved against the repo root.
 */
export async function getPluginSkillPaths(repoDir: string): Promise<string[]> {
    const manifest = await readPluginManifest(repoDir);
    if (!manifest) return [];

    return manifest.skills.map(s => path.resolve(repoDir, s.path));
}
