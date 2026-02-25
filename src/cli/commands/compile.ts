import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getCombo } from "../../lib/registry.js";

export const compileCmd = new Command("compile")
    .description("Compile and validate a locked combo for Type-Safety")
    .argument("<comboName>", "The name of the locked combo")
    .action(async (comboName) => {
        console.log(ui.title("Compiling V2 Combo"));

        try {
            const combo = await getCombo(process.cwd(), comboName);
            if (!combo) {
                throw new Error(`Combo '${comboName}' not found in registry.`);
            }

            console.log(ui.dim(`Found combo: ${comboName}`));
            console.log(ui.dim(`  Tal:   ${combo.tal}`));
            console.log(ui.dim(`  Dance: ${combo.dance}`));
            if (combo.act) {
                console.log(ui.dim(`  Act:   ${combo.act}`));
            }

            console.log(ui.success("\nType-Safety validation running..."));

            import("../../lib/engine.js").then(async ({ validateComboFiles }) => {
                await validateComboFiles(process.cwd(), combo);
                console.log(ui.success("✔ Compilation sequence completed without errors."));
            }).catch(err => {
                console.error(ui.error(`Compilation Failed: ${err.message}`));
                process.exit(1);
            });

        } catch (err: any) {
            console.error(ui.error(`Compilation Failed: ${err.message}`));
            process.exit(1);
        }
    });
