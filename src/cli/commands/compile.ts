import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getPerformer } from "../../lib/registry.js";

export const compileCmd = new Command("compile")
    .description("Compile and validate a locked performer for Type-Safety")
    .argument("<performerName>", "The name of the locked performer")
    .action(async (performerName) => {
        console.log(ui.title("Compiling Performer"));

        try {
            const performer = await getPerformer(process.cwd(), performerName);
            if (!performer) {
                throw new Error(`Performer '${performerName}' not found in registry.`);
            }

            console.log(ui.dim(`Found performer: ${performerName}`));
            console.log(ui.dim(`  Tal:   ${performer.tal}`));
            if (performer.dance) {
                console.log(ui.dim(`  Dance: ${performer.dance}`));
            }
            if (performer.model) {
                console.log(ui.dim(`  Model: ${performer.model}`));
            }

            console.log(ui.success("\nType-Safety validation running..."));
            const { validatePerformerFiles } = await import("../../lib/engine.js");
            await validatePerformerFiles(process.cwd(), performer);
            console.log(ui.success("✔ Compilation sequence completed without errors."));

        } catch (err: any) {
            console.error(ui.error(`Compilation Failed: ${err.message}`));
            process.exit(1);
        }
    });
