import { ui } from "../utils/ui.js";
import { initRegistry } from "../../lib/registry.js";

export async function runInit() {
    console.log(ui.title("Initializing Dance of Tal"));

    try {
        await initRegistry(process.cwd());
        console.log(ui.success("Created workspace directory structure:"));
        console.log(ui.dim("  .dance-of-tal/assets/<kind>/@author/<slug>.json"));
        console.log(ui.dim("  .dance-of-tal/drafts/<kind>/"));
    } catch (err: any) {
        console.log(ui.error(`Failed to initialize: ${err.message}`));
    }

    console.log(ui.success("\nDOT setup complete!"));
    console.log(ui.dim("    Next: dot install performer/@<author>/<name>"));
}
