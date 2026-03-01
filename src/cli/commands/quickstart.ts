import readline from "readline";
import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { runInit } from "./init.js";
import { runSwitch } from "./switch.js";
import { runInstall } from "./install.js";
import { lockCombo, assetFilePath, getDotDir } from "../../lib/registry.js";
import { existsSync } from "fs";
import fs from "fs/promises";
import https from "https";

// ─── Recommendation Fallback ───────────────────────────────────────────────

type Category = "saas" | "data" | "finance" | "content" | "mobile" | "other";
type Style = "structured" | "stepbystep" | "conversational";

const FALLBACK_RECOMMENDATION = "combo/@dot-presets/gpt-architecture-review";

// ─── Readline helpers ──────────────────────────────────────────────────────

function createRl() {
    return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
    return new Promise((resolve) => rl.question(question, resolve));
}

async function pickFromMenu(
    rl: readline.Interface,
    prompt: string,
    options: { label: string; value: string }[]
): Promise<string> {
    console.log("\n" + ui.step(prompt));
    options.forEach((o, i) => console.log(`  ${ui.dim(`${i + 1}.`)} ${o.label}`));

    while (true) {
        const raw = await ask(rl, ui.dim(`\n  Enter number (1-${options.length}): `));
        const n = parseInt(raw.trim(), 10);
        if (n >= 1 && n <= options.length) return options[n - 1].value;
        console.log(ui.warning(`  Please enter a number between 1 and ${options.length}.`));
    }
}

async function fetchVerifiedComboRecommendation(category: string, style: string): Promise<string> {
    const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal-v2.workers.dev";
    try {
        const response = await fetch(`${REGISTRY_URL}/packages?category=combo&tier=verified`);
        if (!response.ok) return FALLBACK_RECOMMENDATION;

        const data = await response.json() as any;
        if (!data.success || !data.packages || data.packages.length === 0) {
            return FALLBACK_RECOMMENDATION;
        }

        // Try to match tags
        const searchTags = [category, style];
        const rankedPackages = data.packages.map((pkg: any) => {
            let score = 0;
            if (pkg.tags) {
                for (const tag of pkg.tags) {
                    if (searchTags.includes(tag)) score++;
                }
            }
            return { pkg, score };
        });

        // Sort by score descending
        rankedPackages.sort((a: any, b: any) => b.score - a.score);

        // Return highest scoring package, or fallback if none found
        if (rankedPackages.length > 0) {
            return rankedPackages[0].pkg.urn;
        }

        return FALLBACK_RECOMMENDATION;
    } catch (e) {
        // Offline fallback
        return FALLBACK_RECOMMENDATION;
    }
}

// ─── Command ────────────────────────────────────────────────────────────────

export const quickstartCmd = new Command("quickstart")
    .description("Interactive setup wizard — get started with dot in 60 seconds")
    .action(async () => {
        console.log("\n" + ui.title("Welcome to Dance of Tal ✦"));
        console.log(ui.dim("We'll pick the right combo for you in 3 quick questions.\n"));

        const rl = createRl();

        try {
            const cwd = process.cwd();

            // ── Step 0: Initialize if needed ──────────────────────────────
            const dotDir = getDotDir(cwd);
            if (!existsSync(dotDir)) {
                console.log(ui.dim("Initializing workspace…"));
                await runInit();
            } else {
                console.log(ui.dim("✔ Workspace already initialized."));
            }

            // ── Step 1: What are you building? ────────────────────────────
            const category = await pickFromMenu(rl, "What are you building?", [
                { label: "SaaS / Web App", value: "saas" },
                { label: "Data / Analytics tool", value: "data" },
                { label: "Finance / Investment tool", value: "finance" },
                { label: "Content / Marketing", value: "content" },
                { label: "Mobile App", value: "mobile" },
                { label: "Something else", value: "other" },
            ]) as Category;

            // ── Step 2: Preferred output style ────────────────────────────
            const style = await pickFromMenu(rl, "How should the AI respond?", [
                { label: "Structured output (JSON, reports, checklists)", value: "structured" },
                { label: "Step-by-step reasoning", value: "stepbystep" },
                { label: "Conversational and concise", value: "conversational" },
            ]) as Style;

            // ── Step 2.5: Fetch Recommendation ────────────────────────────
            console.log(ui.dim("\n  Finding the best combo..."));
            const comboUrn = await fetchVerifiedComboRecommendation(category, style);
            const slug = comboUrn.split("/")[2];

            console.log("\n" + ui.success(`\n✦ Recommended combo: ${ui.highlight(comboUrn)}`));

            const confirm = await ask(rl, ui.dim(`\n  Install and activate this combo? (Y/n): `));
            if (confirm.trim().toLowerCase() === "n") {
                console.log(ui.dim("\nNo problem. Browse the full registry with: dot search <keyword>"));
                rl.close();
                return;
            }

            rl.close();

            // ── Step 3: Install + lock + switch ───────────────────────────
            console.log(ui.dim("\nInstalling combo and dependencies…\n"));
            await runInstall(comboUrn);

            // Build lockfile from installed combo
            const comboFilePath = assetFilePath(cwd, comboUrn);
            const raw = await fs.readFile(comboFilePath, "utf-8");
            const comboContent = JSON.parse(raw) as { tal: string; dance: string | string[]; act?: string };

            await lockCombo(cwd, slug, {
                tal: comboContent.tal,
                dance: comboContent.dance,
                act: comboContent.act,
            });

            await runSwitch(slug);

            // ── Done ──────────────────────────────────────────────────────
            console.log("\n" + ui.success("✔ You're all set!\n"));
            console.log(ui.dim("  Active combo: ") + ui.highlight(slug));
            console.log(ui.dim("  Try it now:   ") + ui.command(`dot run ${slug} --task "Your first task"`));
            console.log(ui.dim("  MCP mode:     init_run → get_run_context (Cursor / Windsurf)\n"));
        } catch (err: any) {
            rl.close();
            console.error(ui.error(`\nQuickstart failed: ${err.message}`));
            process.exit(1);
        }
    });
