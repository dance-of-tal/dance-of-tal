import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { readAgentManifest, writeAgentManifest } from "../../lib/agents.js";
import { getPerformer } from "../../lib/registry.js";

const agentsCmd = new Command("agents")
    .description("Manage agent name → performer mappings for orchestration");

/**
 * dot agents set --agent <name> --performer <performerName>
 * Maps an agent name to a locally locked performer.
 */
agentsCmd
    .command("set")
    .description("Assign a performer to an agent name")
    .requiredOption("--agent <agentName>", "Agent name (e.g. reviewer, implementer, tester)")
    .requiredOption("--performer <performerName>", "Locally locked performer name (e.g. sprint, pr-review)")
    .action(async (options) => {
        try {
            const cwd = process.cwd();

            const performer = await getPerformer(cwd, options.performer);
            if (!performer) {
                throw new Error(
                    `Performer '${options.performer}' not found locally.\n` +
                    `  Run 'dot install performer/@<author>/${options.performer}' to install it first.`
                );
            }

            const manifest = await readAgentManifest(cwd);
            manifest[options.agent] = options.performer;
            await writeAgentManifest(cwd, manifest);

            console.log(ui.success(`✔ Agent '${options.agent}' → performer '${options.performer}' saved.`));
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
    .description("List all agent names and their assigned performers")
    .action(async () => {
        try {
            const cwd = process.cwd();
            const manifest = await readAgentManifest(cwd);
            const entries = Object.entries(manifest);

            if (entries.length === 0) {
                console.log(ui.warning("No agents defined."));
                console.log(ui.dim("Add one with: dot agents set --agent <name> --performer <performerName>"));
                return;
            }

            console.log(ui.title("Agent Mappings"));
            console.log(ui.dim(`  .dance-of-tal/agents.json\n`));

            const maxLen = Math.max(...entries.map(([name]) => name.length));
            for (const [name, performerName] of entries) {
                console.log(`  ${ui.highlight(name.padEnd(maxLen))}  →  ${ui.command(performerName)}`);
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
