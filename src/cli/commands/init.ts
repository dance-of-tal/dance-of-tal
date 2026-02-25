import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";
import { initRegistry } from "../../lib/registry.js";

export async function runInit() {
    console.log(ui.title("Initializing Dance of Tal V2"));

    try {
        await initRegistry(process.cwd());
        console.log(ui.success("Created V2 directory structure:"));
        console.log(ui.dim("  - .dance-of-tal/registry/"));
        console.log(ui.dim("  - .dance-of-tal/runs/"));
        console.log(ui.dim("  - .dance-of-tal/mailbox/"));
        console.log(ui.dim("  - .dance-of-tal/act-graphs/"));
    } catch (err: any) {
        console.log(ui.error(`Failed to initialize registry: ${err.message}`));
    }

    console.log(ui.success("\nDOT setup complete!"));
    console.log(ui.dim("Try running: dot install tal/@monarchjuno/strategy-chief"));
}
