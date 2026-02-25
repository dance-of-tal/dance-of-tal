import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getCombo } from "../../lib/registry.js";
import { compileContext } from "../../lib/engine.js";
import fs from "fs/promises";

export const runCmd = new Command("run")
    .description("Execute a combo directly from the CLI and print output (CLI Execution Mode)")
    .argument("<comboName>", "The name of the locked combo to run")
    .option("--input <filePath>", "Path to a file to use as the input task context")
    .option("--task <string>", "Direct string input for the task context")
    .action(async (comboName, options) => {
        try {
            const combo = await getCombo(process.cwd(), comboName);
            if (!combo) {
                throw new Error(`Combo '${comboName}' not found in registry.`);
            }

            let taskContext = "";
            if (options.input) {
                taskContext = await fs.readFile(options.input, "utf-8");
            } else if (options.task) {
                taskContext = options.task;
            } else {
                throw new Error("You must provide either --input <filePath> or --task <string>");
            }

            const compiled = await compileContext(combo, taskContext);

            // In a full production implementation, we would pass `compiled.systemPrompt`
            // and `compiled.schema` to an LLM provider (OpenAI, Anthropic) using local API keys.
            // For the scope of this migration, we demonstrate the Execution Output:

            console.log(ui.title("V2 Execution Mode: Compiled Payload"));
            console.log(ui.dim("--- SYSTEM PROMPT (Sent to LLM) ---"));
            console.log(compiled.systemPrompt);

            if (compiled.schema) {
                console.log(ui.dim("\n--- ENFORCED JSON SCHEMA ---"));
                console.log(JSON.stringify(compiled.schema, null, 2));
            }

        } catch (err: any) {
            console.error(ui.error(`Execution Failed: ${err.message}`));
            process.exit(1);
        }
    });
