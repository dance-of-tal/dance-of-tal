import path from "path";
import { ui } from "../utils/ui.js";
import { getDotDir, getCombo } from "../../lib/registry.js";
import fs from "fs/promises";
import { existsSync, readdirSync } from "fs";

const CONFIG_FILE = "combo.config.json";

/**
 * Reads the active combo config.
 * Config file: .dance-of-tal/combo.config.json
 */
export async function readConfig(dotDir: string): Promise<Record<string, any>> {
    const configPath = path.join(dotDir, CONFIG_FILE);
    try {
        const raw = await fs.readFile(configPath, "utf-8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

export async function writeConfig(dotDir: string, config: Record<string, any>): Promise<void> {
    const configPath = path.join(dotDir, CONFIG_FILE);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/** Detects the current IDE stage from environment heuristics. */
function detectStage(): string {
    if (process.env.WINDSURF) return "windsurf";
    if (process.env.TERM_PROGRAM === "vscode") return "cursor";
    return "generic";
}

export async function runSwitch(comboName: string) {
    const cwd = process.cwd();
    const dotDir = getDotDir(cwd);

    if (!existsSync(dotDir)) {
        throw new Error("Project not initialized. Please run 'dot init' first.");
    }

    // Verify the combo exists using the same getCombo() path as lock/compile
    // Path: .dance-of-tal/combo/<name>.json
    const combo = await getCombo(cwd, comboName);
    if (!combo) {
        // List available combos to help the user
        const comboDir = path.join(dotDir, "combo");
        let available = "(none)";
        if (existsSync(comboDir)) {
            const files = readdirSync(comboDir)
                .filter((f) => f.endsWith(".json"))
                .map((f) => f.replace(/\.json$/, ""));
            if (files.length > 0) available = files.join(", ");
        }
        throw new Error(
            `Combo '${comboName}' not found.\n  Available: ${available}\n  Run 'dot lock' to create one.`
        );
    }

    const config = await readConfig(dotDir);
    config.activeCombo = comboName;
    if (!config.activeStage) {
        config.activeStage = detectStage();
    }
    await writeConfig(dotDir, config);

    console.log(ui.success(`\nActive combo switched to: ${comboName}`));
    console.log(ui.dim(`  tal:   ${combo.tal}`));
    console.log(ui.dim(`  dance: ${Array.isArray(combo.dance) ? combo.dance.join(", ") : combo.dance}`));
    if (combo.act) console.log(ui.dim(`  act:   ${combo.act}`));
    console.log(ui.dim(`  stage: ${config.activeStage}`));
}
