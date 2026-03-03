import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { readAgentManifest, writeAgentManifest } from "../../lib/agents.js";
import { getCombo } from "../../lib/registry.js";

const agentsCmd = new Command("agents")
    .description("Manage agent name → combo mappings for orchestration");

/**
 * dot agents set --agent <name> --combo <comboName>
 * Maps an agent name to a locally locked combo.
 */
agentsCmd
    .command("set")
    .description("Assign a combo to an agent name")
    .requiredOption("--agent <agentName>", "Agent name (e.g. reviewer, implementer, tester)")
    .requiredOption("--combo <comboName>", "Locally locked combo name (e.g. sprint, pr-review)")
    .action(async (options) => {
        try {
            const cwd = process.cwd();

            const combo = await getCombo(cwd, options.combo);
            if (!combo) {
                throw new Error(
                    `Combo '${options.combo}' not found locally.\n` +
                    `  Run 'dot install combo/@<author>/${options.combo}' to install it first.`
                );
            }

            const manifest = await readAgentManifest(cwd);
            manifest[options.agent] = options.combo;
            await writeAgentManifest(cwd, manifest);

            console.log(ui.success(`✔ Agent '${options.agent}' → combo '${options.combo}' saved.`));
            console.log(ui.dim(`  Saved to: .dance-of-tal/agents.json`));
        } catch (err: any) {
            console.error(ui.error(`Failed to set agent: ${err.message}`));
            process.exit(1);
        }
    });

/**
 * dot agents list
 */
agentsCmd
    .command("list")
    .description("List all agent names and their assigned combos")
    .action(async () => {
        try {
            const cwd = process.cwd();
            const manifest = await readAgentManifest(cwd);
            const entries = Object.entries(manifest);

            if (entries.length === 0) {
                console.log(ui.warning("No agents defined."));
                console.log(ui.dim("Add one with: dot agents set --agent <name> --combo <comboName>"));
                return;
            }

            console.log(ui.title("Agent Mappings"));
            console.log(ui.dim(`  .dance-of-tal/agents.json\n`));

            const maxLen = Math.max(...entries.map(([name]) => name.length));
            for (const [name, comboName] of entries) {
                console.log(`  ${ui.highlight(name.padEnd(maxLen))}  →  ${ui.command(comboName)}`);
            }
            console.log("");
        } catch (err: any) {
            console.error(ui.error(`Failed to list agents: ${err.message}`));
            process.exit(1);
        }
    });

/**
 * dot agents remove --agent <name>
 */
agentsCmd
    .command("remove")
    .description("Remove an agent from the manifest")
    .requiredOption("--agent <agentName>", "Agent name to remove")
    .action(async (options) => {
        try {
            const cwd = process.cwd();
            const manifest = await readAgentManifest(cwd);

            if (!(options.agent in manifest)) {
                throw new Error(`Agent '${options.agent}' does not exist in agents.json.`);
            }

            delete manifest[options.agent];
            await writeAgentManifest(cwd, manifest);

            console.log(ui.success(`✔ Agent '${options.agent}' removed.`));
        } catch (err: any) {
            console.error(ui.error(`Failed to remove agent: ${err.message}`));
            process.exit(1);
        }
    });

export { agentsCmd };
