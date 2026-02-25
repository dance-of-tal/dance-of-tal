import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { lockCombo, Combo } from "../../lib/registry.js";

export const lockCmd = new Command("lock")
    .description("Lock a Type-Safe Dance of Tal combo for this project")
    .requiredOption("--name <comboName>", "The name for this combo")
    .requiredOption("--tal <talType>", "The Tal URN (e.g. tal/system-architect)")
    .requiredOption("--dance <danceType>", "The Dance URN (e.g. dance/json-schema)")
    .option("--act <actType>", "The Optional Act URN")
    .action(async (options) => {
        console.log(ui.title("Locking Combo"));

        try {
            const combo: Combo = {
                tal: options.tal,
                dance: options.dance,
                act: options.act
            };

            await lockCombo(process.cwd(), options.name, combo);

            console.log(ui.success(`Successfully locked combo: ${options.name}`));
            console.log(ui.dim(JSON.stringify(combo, null, 2)));
            console.log(ui.dim("\nTo compile and verify this combo, run:"));
            console.log(ui.dim(`  dot compile --name ${options.name}`));
        } catch (err: any) {
            console.error(ui.error(`Failed to lock combo: ${err.message}`));
            process.exit(1);
        }
    });
