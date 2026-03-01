import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { readAgentManifest, writeAgentManifest } from "../../lib/agents.js";
import { getCombo } from "../../lib/registry.js";

const agentsCmd = new Command("agents")
    .description("Manage agent role → combo mappings for orchestration");

/**
 * dot agents set --role <name> --combo <comboName>
 * Maps an agent role to a locally locked combo.
 */
agentsCmd
    .command("set")
    .description("Assign a combo to an agent role")
    .requiredOption("--role <roleName>", "Agent role name (e.g. reviewer, implementer, tester)")
    .requiredOption("--combo <comboName>", "Locally locked combo name (e.g. sprint, pr-review)")
    .action(async (options) => {
        try {
            const cwd = process.cwd();

            // Verify the combo exists locally
            const combo = await getCombo(cwd, options.combo);
            if (!combo) {
                throw new Error(
                    `Combo '${options.combo}' not found locally.\n` +
                    `  Run 'dot lock --name ${options.combo} ...' to create it first.`
                );
            }

            const manifest = await readAgentManifest(cwd);
            manifest[options.role] = options.combo;
            await writeAgentManifest(cwd, manifest);

            console.log(ui.success(`✔ Agent role '${options.role}' → combo '${options.combo}' saved.`));
            console.log(ui.dim(`  Saved to: .dance-of-tal/agents.json`));
        } catch (err: any) {
            console.error(ui.error(`Failed to set agent role: ${err.message}`));
            process.exit(1);
        }
    });

/**
 * dot agents list
 * Lists all agent roles defined in agents.json.
 */
agentsCmd
    .command("list")
    .description("List all agent roles and their assigned combos")
    .action(async () => {
        try {
            const cwd = process.cwd();
            const manifest = await readAgentManifest(cwd);
            const entries = Object.entries(manifest);

            if (entries.length === 0) {
                console.log(ui.warning("No agent roles defined."));
                console.log(ui.dim("Add one with: dot agents set --role <name> --combo <comboName>"));
                return;
            }

            console.log(ui.title("Agent Roles"));
            console.log(ui.dim(`  .dance-of-tal/agents.json\n`));

            const maxLen = Math.max(...entries.map(([role]) => role.length));
            for (const [role, comboName] of entries) {
                console.log(`  ${ui.highlight(role.padEnd(maxLen))}  →  ${ui.command(comboName)}`);
            }
            console.log("");
        } catch (err: any) {
            console.error(ui.error(`Failed to list agents: ${err.message}`));
            process.exit(1);
        }
    });

/**
 * dot agents remove --role <name>
 * Removes an agent role from agents.json.
 */
agentsCmd
    .command("remove")
    .description("Remove an agent role from the manifest")
    .requiredOption("--role <roleName>", "Agent role name to remove")
    .action(async (options) => {
        try {
            const cwd = process.cwd();
            const manifest = await readAgentManifest(cwd);

            if (!(options.role in manifest)) {
                throw new Error(`Agent role '${options.role}' does not exist in agents.json.`);
            }

            delete manifest[options.role];
            await writeAgentManifest(cwd, manifest);

            console.log(ui.success(`✔ Agent role '${options.role}' removed.`));
        } catch (err: any) {
            console.error(ui.error(`Failed to remove agent role: ${err.message}`));
            process.exit(1);
        }
    });

export { agentsCmd };
