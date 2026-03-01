import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getAuthUser } from "./login.js";
import { getCombo, assetFilePath } from "../../lib/registry.js";
import fs from "fs/promises";

const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal-v2.workers.dev";

/**
 * Loads a locally installed asset using the logged-in author's namespace.
 *
 * --name accepts either:
 *   a) plain slug:      "strategy-chief"
 *   b) @author/name:   "@dot-presets/strategy-chief"
 *
 * The author is resolved from auth.json (set during `dot login`).
 * File path: .dance-of-tal/<category>/@<author>/<name>.json
 */
async function loadLocalAsset(
    cwd: string,
    category: string,
    name: string,
    username: string
): Promise<Record<string, unknown>> {
    // Normalise the name to just the slug (strip @author/ prefix if present)
    const slug = name.includes("/")
        ? name.split("/").pop()!          // "@dot-presets/strategy-chief" → "strategy-chief"
        : name;                           // "strategy-chief" stays as is

    const urn = `${category}/@${username}/${slug}`;
    const filePath = assetFilePath(cwd, urn);

    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw) as Record<string, unknown>;
    } catch (err: any) {
        if (err.code === "ENOENT") {
            throw new Error(
                `Asset not found at '${filePath}'.\n` +
                `  Run 'dot install ${urn}' first, or place the file manually.`
            );
        }
        throw err;
    }
}

export const publishCmd = new Command("publish")
    .description("Publish a Type-Safe Dance of Tal asset or combo to the remote registry")
    .requiredOption("--category <category>", "The type of asset: tal, dance, act, combo")
    .requiredOption(
        "--name <name>",
        "Asset slug (e.g. strategy-chief) or @author/name — author defaults to logged-in GitHub user"
    )
    .option("--tags <tags>", "Comma-separated list of tags (e.g. 'frontend,react,architect')")
    .action(async (options) => {
        console.log(ui.title("Publishing Asset to Registry"));

        try {
            // 1. Enforce Authentication — also provides the author namespace
            const auth = await getAuthUser();
            if (!auth) {
                throw new Error("You are not logged in. Please run `dot login` first.");
            }

            const validCategories = ["tal", "dance", "act", "combo"];
            if (!validCategories.includes(options.category)) {
                throw new Error(`Invalid category. Must be one of: ${validCategories.join(", ")}`);
            }

            const cwd = process.cwd();
            let payload: Record<string, unknown>;

            // 2. Load the actual content to publish
            if (options.category === "combo") {
                // Combo name is always a plain slug (no author prefix)
                const slug = options.name.includes("/") ? options.name.split("/").pop()! : options.name;
                const combo = await getCombo(cwd, slug);
                if (!combo) {
                    throw new Error(`Combo '${slug}' not found locally. Did you run 'dot lock'?`);
                }
                payload = combo as unknown as Record<string, unknown>;
            } else {
                payload = await loadLocalAsset(cwd, options.category, options.name, auth.username);
            }

            // 3. Parse tags
            const tagsArray = options.tags
                ? options.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
                : [];

            // 4. Registry expects plain slug as `name` — author is injected by the Worker from the token
            const slug = options.name.includes("/") ? options.name.split("/").pop()! : options.name;

            console.log(ui.dim(`Pushing ${options.category}/@${auth.username}/${slug} to ${REGISTRY_URL}...`));

            const res = await fetch(`${REGISTRY_URL}/publish`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${auth.token}`,
                },
                body: JSON.stringify({
                    category: options.category,
                    name: slug,          // plain slug — no @author prefix
                    tags: tagsArray,
                    payload,
                }),
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
