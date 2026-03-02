import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { runInstall } from "./install.js";
import { lockCombo } from "../../lib/registry.js";
import { runSwitch } from "./switch.js";

/**
 * dot use <combo-urn> [--name <alias>]
 *
 * One-command shortcut: install + lock + switch.
 * Designed for vibe coders who just want to get started fast.
 *
 * Examples:
 *   dot use combo/@dot-presets/gpt-safe-investor
 *   dot use combo/@dot-presets/gpt-architecture-review --name my-arch
 */
export const useCmd = new Command("use")
    .description("Install, lock, and activate a combo in one command (vibe coder shortcut)")
    .argument("<combo-urn>", "Full combo URN: combo/@<author>/<name>")
    .option("--name <alias>", "Custom local name for the lockfile (defaults to the combo slug)")
    .action(async (comboUrn: string, options) => {
        // Validate URN
        const parts = comboUrn.split("/");
        if (
            parts.length !== 3 ||
            parts[0] !== "combo" ||
            !parts[1].startsWith("@")
        ) {
            console.error(
                ui.error(
                    `Invalid combo URN: '${comboUrn}'\n  Expected: combo/@<author>/<name>\n  Example:  combo/@dot-presets/gpt-safe-investor`
                )
            );
            process.exit(1);
        }

        const slug = parts[2]; // e.g. "gpt-safe-investor"
        const localName = options.name ?? slug;

        console.log(ui.title(`dot use: ${comboUrn}`));
        console.log(ui.dim("Step 1/3 — Installing combo and dependencies...\n"));

        try {
            // 1. Install combo + all dependencies (cascading)
            await runInstall(comboUrn);

            // 2. Read combo content to build the lockfile
            console.log(ui.dim("\nStep 2/3 — Creating lockfile...\n"));

            const { assetFilePath } = await import("../../lib/registry.js");
            const cwd = process.cwd();

            // The combo content lands at .dance-of-tal/combo/@author/slug.json
            // but getCombo reads from .dance-of-tal/combo/<name>.json (flat)
            // So we write it there directly.
            const comboRaw = await (async () => {
                const filePath = assetFilePath(cwd, comboUrn);
                const fs = await import("fs/promises");
                const raw = await fs.readFile(filePath, "utf-8");
                return JSON.parse(raw) as { tal: string; dance: string | string[]; act?: string };
            })();

            await lockCombo(cwd, localName, {
                tal: comboRaw.tal,
                dance: comboRaw.dance,
                act: comboRaw.act,
            });

            console.log(ui.success(`  ✔ Lockfile created: .dance-of-tal/combo/${localName}.json`));

            // 3. Switch active combo
            console.log(ui.dim("\nStep 3/3 — Switching active combo...\n"));
            await runSwitch(localName);

            console.log(
                "\n" +
                ui.success(`✔ Ready! Active combo: ${ui.highlight(localName)}`) +
                "\n"
            );
            console.log(ui.dim(`  Try it: dot run ${localName} --task "Your task here"`));
            console.log(ui.dim(`  MCP:    init_run → get_run_context (uses combo '${localName}')`));
        } catch (err: any) {
            console.error(ui.error(`\ndot use failed: ${err.message}`));
            process.exit(1);
        }
    });
