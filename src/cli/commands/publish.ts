import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getAuthToken } from "./login.js";
import { getCombo } from "../../lib/registry.js";

// Registry endpoint URL (Can be overridden via env for testing)
const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal-v2.workers.dev"; // Fallback demo registry url

export const publishCmd = new Command("publish")
    .description("Publish a Type-Safe Dance of Tal asset or combo to the remote registry")
    .requiredOption("--category <category>", "The type of asset to publish: tal, dance, act, stage, combo")
    .requiredOption("--name <name>", "The name of the asset (e.g., strategy-chief)")
    .option("--tags <tags>", "Comma-separated list of tags (e.g., 'frontend,react,architect')")
    .action(async (options) => {
        console.log(ui.title("Publishing Asset to Registry"));

        try {
            // 1. Enforce Authentication
            const token = await getAuthToken();
            if (!token) {
                throw new Error("You are not logged in. Please run `dot login` first.");
            }

            const validCategories = ['tal', 'dance', 'act', 'stage', 'combo'];
            if (!validCategories.includes(options.category)) {
                throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
            }

            const cwd = process.cwd();
            let payload: any = null;

            // 2. Fetch the actual content to publish
            if (options.category === 'combo') {
                // Publish a local locked combo
                const combo = await getCombo(cwd, options.name);
                if (!combo) throw new Error(`Combo '${options.name}' not found locally. Did you run 'dot lock'?`);
                payload = combo;
            } else {
                // In a full implementation, this reads from `mcp/src/data/tals/` or the user's local project
                // For this demonstration, we simulate packing a predefined json struct
                payload = {
                    version: "2.0.0",
                    description: `A custom user-published ${options.category}`,
                    mock_data: true
                };
            }

            // 3. Parse tags
            const tagsArray = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];

            // 4. Construct payload for Cloudflare Worker
            const publishData = {
                category: options.category,
                name: options.name,
                tags: tagsArray,
                payload: payload
            };

            console.log(ui.dim(`Pushing ${options.category}/${options.name} to ${REGISTRY_URL}...`));

            const res = await fetch(`${REGISTRY_URL}/publish`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(publishData)
            });

            if (!res.ok) {
                const errorData: any = await res.json().catch(() => ({}));
                throw new Error(errorData.error || res.statusText);
            }

            const result: any = await res.json();
            if (result.success) {
                console.log(ui.success(`\n✔ ${result.message}`));
            } else {
                throw new Error(result.error || "Unknown error occurred");
            }

        } catch (err: any) {
            console.error(ui.error(`Publish failed: ${err.message}`));
            process.exit(1);
        }
    });
