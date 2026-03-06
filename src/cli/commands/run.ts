import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getPerformer } from "../../lib/registry.js";
import { compileContext } from "../../lib/engine.js";
import fs from "fs/promises";

export const runCmd = new Command("run")
    .description("Execute a performer directly from the CLI and print output (CLI Execution Mode)")
    .argument("<performerName>", "The name of the locked performer to run")
    .option("--input <filePath>", "Path to a file to use as the input task context")
    .option("--task <string>", "Direct string input for the task context")
    .action(async (performerName, options) => {
        try {
            const performer = await getPerformer(process.cwd(), performerName);
            if (!performer) {
                throw new Error(`Performer '${performerName}' not found in registry.`);
            }

            let taskContext = "";
            if (options.input) {
                taskContext = await fs.readFile(options.input, "utf-8");
            } else if (options.task) {
                taskContext = options.task;
            } else {
                throw new Error("You must provide either --input <filePath> or --task <string>");
            }

            const compiled = await compileContext(performer, taskContext);

            // Pass `compiled.systemPrompt` and `compiled.schema` to your LLM provider
            // (OpenAI, Anthropic, etc.) using local API keys.

            console.log(ui.title("Compiled Payload"));
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
