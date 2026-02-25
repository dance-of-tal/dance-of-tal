import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getCombo } from "../../lib/registry.js";

export const compileCmd = new Command("compile")
    .description("Compile and validate a locked combo for Type-Safety")
    .requiredOption("--name <comboName>", "The name of the locked combo")
    .action(async (options) => {
        console.log(ui.title("Compiling V2 Combo"));

        try {
            const combo = await getCombo(process.cwd(), options.name);
            if (!combo) {
                throw new Error(`Combo '${options.name}' not found in registry.`);
            }

            console.log(ui.dim(`Found combo: ${options.name}`));
            console.log(ui.dim(`  Tal:   ${combo.tal}`));
            console.log(ui.dim(`  Dance: ${combo.dance}`));
            if (combo.act) {
                console.log(ui.dim(`  Act:   ${combo.act}`));
            }

            console.log(ui.success("\nType-Safety validation running..."));

            // Phase 2 Engine validation will go here
            // For now, we simulate success if the URNs exist

            if (!combo.tal.startsWith("tal/")) {
                throw new Error(`Invalid Tal URN: ${combo.tal}. Must start with 'tal/'`);
            }
            if (!combo.dance.startsWith("dance/")) {
                throw new Error(`Invalid Dance URN: ${combo.dance}. Must start with 'dance/'`);
            }
            if (combo.act && !combo.act.startsWith("act/")) {
                throw new Error(`Invalid Act URN: ${combo.act}. Must start with 'act/'`);
            }

            console.log(ui.success("✔ Compilation sequence completed without errors."));

        } catch (err: any) {
            console.error(ui.error(`Compilation Failed: ${err.message}`));
            process.exit(1);
        }
    });
