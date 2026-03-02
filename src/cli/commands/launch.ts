import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { runInit } from "./init.js";
import { runInstall } from "./install.js";
import { runSwitch } from "./switch.js";
import { lockCombo, assetFilePath, getDotDir } from "../../lib/registry.js";
import { applyStage, isStageType, ComboAssets } from "../stages/index.js";
import { existsSync } from "fs";
import fs from "fs/promises";
import { exec } from "child_process";

export const launchCmd = new Command("launch")
    .description("Launch a combo or act in an IDE (e.g. dot launch act/@acme/incident-response --editor cursor)")
    .argument("<urn>", "Full URN (e.g. act/@acme/incident-response)")
    .option("--editor <editor>", "IDE to open: cursor, windsurf, code, codex, openclaw, opencode, claude", "cursor")
    .option("--name <alias>", "Local combo name to lock as (defaults to the asset slug)")
    .option("--stage <environment>", "Generate host-native files: antigravity, cursor, windsurf, codex, openclaw, opencode, claude")
    .action(async (urn: string, options) => {
        console.log("\n" + ui.title(`Launching ${urn} in ${options.editor}`));

        try {
            const parts = urn.split("/");
            if (parts.length !== 3 || !parts[1].startsWith("@")) {
                throw new Error(`Invalid URN format: '${urn}'. Expected: <kind>/@<author>/<name>`);
            }

            const kind = parts[0];
            const slug = parts[2];
            const localName = options.name || slug;
            const cwd = process.cwd();

            // Validate --stage early
            if (options.stage && !isStageType(options.stage)) {
                throw new Error(`Invalid stage: '${options.stage}'. Must be one of: antigravity, cursor, windsurf, codex, openclaw, opencode, claude`);
            }

            // ── Step 1: Initialize Workspace ──────────────────────────────
            const dotDir = getDotDir(cwd);
            if (!existsSync(dotDir)) {
                console.log(ui.dim("Initializing workspace…"));
                await runInit();
            }

            // ── Step 2: Install Package and Dependencies ──────────────────
            console.log(ui.dim("\nInstalling package and dependencies…\n"));
            await runInstall(urn);

            // ── Step 3: Lock & Switch ─────────────────────────────────────
            console.log(ui.dim(`\nLocking local combo as: ${localName}…`));

            let comboAssets: ComboAssets | undefined;

            if (kind === "combo") {
                // If it's a combo, just lock its contents under the localName
                const filePath = assetFilePath(cwd, urn);
                const raw = await fs.readFile(filePath, "utf-8");
                const content = JSON.parse(raw);
                await lockCombo(cwd, localName, {
                    tal: content.tal,
                    dance: content.dance,
                    act: content.act
                });
                comboAssets = {
                    talUrn: content.tal,
                    danceUrns: Array.isArray(content.dance) ? content.dance : [content.dance],
                    actUrn: content.act,
                    comboName: localName,
                };
            } else if (kind === "act") {
                // If it's an act, lock a dedicated combo to play this act
                const filePath = assetFilePath(cwd, urn);
                const raw = await fs.readFile(filePath, "utf-8");
                const content = JSON.parse(raw);

                // Extract tal/dance from the act's start node
                const nodes = content.nodes || {};
                const startNodes = Object.entries(nodes);
                if (startNodes.length === 0) {
                    throw new Error(`Act '${urn}' has no nodes defined.`);
                }
                // Pick the first node listed (or could analyze edges to find real root)
                const [, firstNodeParams] = startNodes[0];
                const nodeParams = firstNodeParams as { tal: string; dance?: string | string[] };

                const danceUrns = nodeParams.dance
                    ? (Array.isArray(nodeParams.dance) ? nodeParams.dance : [nodeParams.dance])
                    : [];

                await lockCombo(cwd, localName, {
                    act: urn,
                    tal: nodeParams.tal,
                    dance: nodeParams.dance || []
                });
                comboAssets = {
                    talUrn: nodeParams.tal,
                    danceUrns,
                    actUrn: urn,
                    comboName: localName,
                };
            } else if (kind === "tal" || kind === "dance") {
                // If it's just a single tal or dance, we lock it with a generic partner just to launch
                throw new Error(`Launching bare ${kind} is not supported. Use an 'act' or 'combo' URN.`);
            } else {
                throw new Error(`Unknown kind: ${kind}`);
            }

            await runSwitch(localName);

            // ── Step 3.5: Apply Stage Adapter ─────────────────────────────
            if (options.stage && comboAssets) {
                console.log(ui.dim(`\nApplying stage: ${options.stage}…`));
                await applyStage(options.stage, cwd, comboAssets);
            }

            // ── Step 4: Launch IDE ────────────────────────────────────────
            console.log(ui.success(`\n✔ Ready! Active combo: ${localName}`));
            console.log(ui.dim(`Launching ${options.editor}...`));

            const launchCommand = `${options.editor} .`;
            exec(launchCommand, (error, _stdout, _stderr) => {
                if (error) {
                    if (error.code === 127) {
                        console.error(ui.error(`\nFailed to launch '${options.editor}'. Command not found.`));
                        console.error(ui.dim(`Ensure the IDE CLI is installed in your PATH.`));
                    } else {
                        console.error(ui.error(`\nFailed to launch IDE: ${error.message}`));
                    }
                } else {
                    console.log(ui.success("\nIDE launched successfully. Check your IDE's AI chat window to start the workflow!"));
                }
            });

        } catch (err: any) {
            console.error(ui.error(`\nLaunch failed: ${err.message}`));
            process.exit(1);
        }
    });
