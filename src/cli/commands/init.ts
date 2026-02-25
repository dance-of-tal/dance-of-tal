import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";
import { initRegistry } from "../../lib/registry.js";

export async function runInit() {
    console.log(ui.title("Initializing Dance of Tal V2"));

    try {
        await initRegistry(process.cwd());
        console.log(ui.success("Created V2 directory structure:"));
        console.log(ui.dim("  .dance-of-tal/combo/    ← locked Combo files"));
        console.log(ui.dim("  .dance-of-tal/runs/     ← isolated agent run sandboxes"));
        console.log(ui.dim("  (assets saved to tal/@author/name.json on dot install)"));
    } catch (err: any) {
        console.log(ui.error(`Failed to initialize: ${err.message}`));
    }

    console.log(ui.success("\nDOT setup complete!"));
    console.log(ui.dim("Next: dot login  →  dot install tal/@monarchjuno/strategy-chief"));
}
