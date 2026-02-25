import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";

function getDotDir() {
    const dotDir = path.join(process.cwd(), ".dance-of-tal");
    if (!fs.existsSync(dotDir)) {
        throw new Error("Project not initialized. Please run 'dot init' first.");
    }
    return dotDir;
}

export async function runSwitch(vibeName: string) {
    const dotDir = getDotDir();
    const vibesDir = path.join(dotDir, "vibes");

    if (!fs.existsSync(vibesDir)) {
        throw new Error("No vibes installed yet. Run 'dot install tal/@monarchjuno/strategy-chief' first.");
    }

    const files = fs.readdirSync(vibesDir);
    const targetFile = files.find(f => f === `${vibeName}.json`);

    if (!targetFile) {
        throw new Error(`Vibe '${vibeName}' not found in installed vibes.`);
    }

    const configPath = path.join(dotDir, "vibe.config.json");
    let config: any = {};
    if (fs.existsSync(configPath)) {
        try {
            config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        } catch { }
    }

    config.activeVibe = vibeName;

    // Future: probe active stage (e.g. VSCode vs Windsurf), for now hardcode generic if null
    if (!config.activeStage) {
        // Basic heuristic: check environment variables.
        if (process.env.WINDSURF) {
            config.activeStage = "windsurf";
        } else if (process.env.TERM_PROGRAM === "vscode") {
            config.activeStage = "cursor"; // Simplification for now, Cursor uses VSCode roots
        } else {
            config.activeStage = "generic";
        }
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(ui.success(`\nProject Vibe switched to: ${vibeName}`));
    console.log(ui.dim(`Stage set to: ${config.activeStage}`));
}
