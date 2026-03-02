/**
 * Stage — Host Adapter Layer
 *
 * Decouples physical execution environment from the declarative assets.
 * Each stage adapter translates locked combo data into host-native integrations.
 *
 * Design principle: "Scoped, not global."
 * Stage output should be on-demand or scoped — not dumped into a global
 * always-on config. This avoids consuming tokens every conversation.
 */

import fs from "fs/promises";
import { parseSkills, Skill } from "./skills-parser.js";
import { applyAntigravityStage } from "./antigravity.js";
import { applyCursorStage, CursorVariant } from "./cursor.js";
import { applyOpenClawStage } from "./openclaw.js";
import { applyCodexStage } from "./codex.js";
import { applyOpenCodeStage } from "./opencode.js";
import { applyClaudeStage } from "./claude.js";
import { assetFilePath } from "../../lib/registry.js";
import { ui } from "../utils/ui.js";

export const STAGE_TYPES = [
    "antigravity",
    "cursor",
    "windsurf",
    "codex",
    "openclaw",
    "opencode",
    "claude",
] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export function isStageType(value: string): value is StageType {
    return (STAGE_TYPES as readonly string[]).includes(value);
}

export interface ComboAssets {
    talUrn: string;
    danceUrns: string[];
    actUrn?: string;
    comboName?: string;
}

/**
 * Apply a stage adapter to the current project.
 *
 * Reads the combo's assets from disk, parses skills, and delegates
 * to the appropriate host adapter.
 */
export async function applyStage(
    stage: StageType,
    cwd: string,
    combo: ComboAssets
): Promise<void> {
    // Load tal asset
    const talPath = assetFilePath(cwd, combo.talUrn);
    const talRaw = await fs.readFile(talPath, "utf-8");
    const tal = JSON.parse(talRaw);

    // Load and merge dance rules
    const allRules: string[] = [];
    for (const danceUrn of combo.danceUrns) {
        const dancePath = assetFilePath(cwd, danceUrn);
        const danceRaw = await fs.readFile(dancePath, "utf-8");
        const dance = JSON.parse(danceRaw);
        if (dance.rules) allRules.push(dance.rules);
    }
    const mergedRules = allRules.join("\n\n");

    // Parse skills from merged rules
    const skills: Skill[] = parseSkills(mergedRules);

    // Load act if present
    let actDescription: string | undefined;
    if (combo.actUrn) {
        try {
            const actPath = assetFilePath(cwd, combo.actUrn);
            const actRaw = await fs.readFile(actPath, "utf-8");
            const act = JSON.parse(actRaw);
            actDescription = act.description;
        } catch {
            // Act is optional, ignore if not found
        }
    }

    const persona = tal.thinking || tal.description || "";
    const comboName = combo.comboName;

    // Dispatch to adapter
    switch (stage) {
        case "antigravity": {
            const written = await applyAntigravityStage(cwd, skills);
            if (written.length > 0) {
                console.log(
                    ui.success(
                        `  ✔ Stage [antigravity]: wrote ${written.length} workflow(s)`
                    )
                );
                for (const f of written) {
                    console.log(ui.dim(`    → ${f}`));
                }
            } else {
                console.log(
                    ui.dim(
                        "  ℹ Stage [antigravity]: no skills found in rules, skipping workflow generation."
                    )
                );
            }
            break;
        }

        case "cursor":
        case "windsurf": {
            const variant: CursorVariant = stage as CursorVariant;
            const written = await applyCursorStage(cwd, variant, {
                persona,
                rules: mergedRules,
                actDescription,
                comboName,
            });
            console.log(
                ui.success(`  ✔ Stage [${stage}]: wrote ${written}`)
            );
            break;
        }

        case "codex": {
            const written = await applyCodexStage(cwd, {
                persona,
                rules: mergedRules,
                actDescription,
                comboName,
            });
            console.log(
                ui.success(`  ✔ Stage [${stage}]: wrote ${written}`)
            );
            break;
        }

        case "openclaw": {
            const written = await applyOpenClawStage(cwd, {
                persona,
                rules: mergedRules,
                actDescription,
            });
            console.log(
                ui.success(`  ✔ Stage [${stage}]: wrote ${written}`)
            );
            break;
        }

        case "opencode": {
            const written = await applyOpenCodeStage(cwd, {
                persona,
                rules: mergedRules,
                actDescription,
                comboName,
            });
            console.log(
                ui.success(`  ✔ Stage [${stage}]: wrote ${written}`)
            );
            break;
        }

        case "claude": {
            const written = await applyClaudeStage(cwd, {
                persona,
                rules: mergedRules,
                actDescription,
            });
            console.log(
                ui.success(`  ✔ Stage [${stage}]: wrote ${written}`)
            );
            break;
        }
    }
}
