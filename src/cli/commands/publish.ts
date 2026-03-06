import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getAuthUser } from "./login.js";
import { getPerformer, assetFilePath } from "../../lib/registry.js";
import fs from "fs/promises";
import { ASSET_KINDS, isAssetKind } from "../../lib/kinds.js";

const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal.workers.dev";
const ASSET_KIND_HELP = ASSET_KINDS.join(", ");

/**
 * Extracts all tal/dance URNs from a performer or act payload,
 * returns those that belong to a different author.
 */
function findForeignAuthorUrns(
    payload: Record<string, unknown>,
    myAuthor: string,
    kind: string
): string[] {
    const urns: string[] = [];

    const collectUrns = (obj: Record<string, unknown>) => {
        if (typeof obj.tal === "string") urns.push(obj.tal);
        const dance = obj.dance;
        if (typeof dance === "string") {
            urns.push(dance);
        } else if (Array.isArray(dance)) {
            for (const d of dance) {
                if (typeof d === "string") urns.push(d);
            }
        }
    };

    if (kind === "performer") {
        collectUrns(payload);
    } else if (kind === "act" && typeof payload.performers === "object" && payload.performers !== null) {
        for (const node of Object.values(payload.performers as Record<string, any>)) {
            if (typeof node === "object" && node !== null) collectUrns(node);
        }
    }

    return urns.filter(urn => {
        const parts = urn.split("/");
        if (parts.length !== 3 || !parts[1].startsWith("@")) return false;
        const author = parts[1].slice(1); // remove leading @
        return author.toLowerCase() !== myAuthor.toLowerCase();
    });
}

/**
 * Loads a locally installed asset using the logged-in author's namespace.
 *
 * --name accepts either:
 *   a) plain slug:      "strategy-chief"
 *   b) @author/name:   "@acme/strategy-chief"
 *
 * The author is resolved from auth.json (set during `dot login`).
 * File path: .dance-of-tal/<kind>/@<author>/<name>.json
 */
async function loadLocalAsset(
    cwd: string,
    kind: string,
    name: string,
    username: string
): Promise<Record<string, unknown>> {
    // Normalise the name to just the slug (strip @author/ prefix if present)
    const slug = name.includes("/")
        ? name.split("/").pop()!          // "@acme/strategy-chief" → "strategy-chief"
        : name;                           // "strategy-chief" stays as is

    const urn = `${kind}/@${username}/${slug}`;
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
    .description("Publish a Type-Safe Dance of Tal asset or performer to the remote registry")
    .requiredOption("--kind <kind>", `The type of asset: ${ASSET_KIND_HELP}`)
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

            if (!isAssetKind(options.kind)) {
                throw new Error(`Invalid kind. Must be one of: ${ASSET_KINDS.join(", ")}`);
            }

            const cwd = process.cwd();
            let payload: Record<string, unknown>;

            // 2. Load the actual content to publish
            if (options.kind === "performer") {
                // Performer name is always a plain slug (no author prefix)
                const slug = options.name.includes("/") ? options.name.split("/").pop()! : options.name;
                const performer = await getPerformer(cwd, slug);
                if (!performer) {
                    throw new Error(`Performer '${slug}' not found locally. Did you run 'dot install performer/@<author>/${slug}'?`);
                }
                payload = performer as unknown as Record<string, unknown>;
            } else {
                payload = await loadLocalAsset(cwd, options.kind, options.name, auth.username);
            }

            // 3. Cross-author validation — block referencing other authors' assets
            if (options.kind === "performer" || options.kind === "act") {
                const foreignUrns = findForeignAuthorUrns(payload, auth.username, options.kind);
                if (foreignUrns.length > 0) {
                    throw new Error(
                        `Cannot publish: payload references assets from other authors.\n` +
                        `  Your namespace: @${auth.username}\n` +
                        `  Foreign references:\n` +
                        foreignUrns.map(u => `    - ${u}`).join("\n") +
                        `\n\n  You can only reference your own assets (@${auth.username}) in published performers/acts.`
                    );
                }
            }

            // 4. Parse tags
            const tagsArray = options.tags
                ? options.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
                : [];

            // 4. Registry expects plain slug as `name` — author is injected by the Worker from the token
            const slug = options.name.includes("/") ? options.name.split("/").pop()! : options.name;

            console.log(ui.dim(`Pushing ${options.kind}/@${auth.username}/${slug} to ${REGISTRY_URL}...`));

            const res = await fetch(`${REGISTRY_URL}/publish`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${auth.token}`,
                },
                body: JSON.stringify({
                    kind: options.kind,
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
