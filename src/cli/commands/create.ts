import { Command } from "commander";
import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";
import { getDotDir, assetFilePath } from "../../lib/registry.js";
import { getAuthUser } from "./login.js";
import { CREATABLE_ASSET_KINDS, CreatableAssetKind, isCreatableAssetKind } from "../../lib/kinds.js";
import {
    ACT_ASSET_SCHEMA,
    DANCE_ASSET_SCHEMA,
    PERFORMER_ASSET_SCHEMA,
    TAL_ASSET_SCHEMA,
} from "../../contracts/index.js";

const CREATABLE_KIND_HELP = CREATABLE_ASSET_KINDS.join(", ");

function defaultTalMarkdown(): string {
    return [
        "# Role",
        "Describe the agent's identity and posture here.",
        "",
        "## Principles",
        "- ...",
        "",
        "## Do",
        "- ...",
        "",
        "## Do Not",
        "- ...",
    ].join("\n");
}

function defaultDanceMarkdown(): string {
    return [
        "# Goal",
        "Describe when and how this skill should be applied.",
        "",
        "## Output Style",
        "- ...",
        "",
        "## Constraints",
        "- ...",
    ].join("\n");
}

function buildTalTemplate(author: string, slug: string, description: string): Record<string, unknown> {
    return {
        $schema: TAL_ASSET_SCHEMA,
        kind: "tal",
        urn: `tal/@${author}/${slug}`,
        description,
        tags: [],
        payload: {
            content: defaultTalMarkdown(),
        },
    };
}

function buildDanceTemplate(author: string, slug: string, description: string): Record<string, unknown> {
    return {
        $schema: DANCE_ASSET_SCHEMA,
        kind: "dance",
        urn: `dance/@${author}/${slug}`,
        description,
        tags: [],
        payload: {
            content: defaultDanceMarkdown(),
        },
    };
}

function buildActTemplate(slug: string, description: string, author: string): Record<string, unknown> {
    return {
        $schema: ACT_ASSET_SCHEMA,
        kind: "act",
        urn: `act/@${author}/${slug}`,
        description,
        tags: [],
        payload: {
            actRules: [
                "Lead owns final approval.",
            ],
            participants: [
                {
                    id: "lead",
                    performer: `performer/@${author}/your-lead`,
                    subscriptions: {
                        callboardKeys: ["shared/*"]
                    }
                },
                {
                    id: "worker",
                    performer: `performer/@${author}/your-worker`
                }
            ],
            relations: [
                {
                    id: "lead-worker-review",
                    between: ["lead", "worker"],
                    direction: "one-way",
                    name: "review_request",
                    description: "Lead coordinates, worker executes.",
                    maxCalls: 10,
                    timeout: 300,
                    sessionPolicy: "reuse",
                }
            ],
        },
    };
}

function buildPerformerTemplate(author: string, slug: string, description: string): Record<string, unknown> {
    return {
        $schema: PERFORMER_ASSET_SCHEMA,
        kind: "performer",
        urn: `performer/@${author}/${slug}`,
        description,
        tags: [],
        payload: {
            tal: `tal/@${author}/your-tal`,
            dances: [`dance/@${author}/your-dance`],
            model: {
                provider: "anthropic",
                modelId: "claude-sonnet-4",
            },
            modelVariant: "normal",
            mcp_config: {
                servers: {
                    github: {
                        command: "npx",
                        args: ["-y", "@modelcontextprotocol/server-github"],
                    },
                },
            },
        },
    };
}

export const createCmd = new Command("create")
    .description("Create a new asset locally (publish later with: dot publish)")
    .requiredOption("--kind <kind>", `Asset type: ${CREATABLE_KIND_HELP}`)
    .requiredOption("--name <slug>", "Asset slug (e.g. my-custom-tal)")
    .option("--author <author>", "Author namespace (defaults to logged-in GitHub username)")
    .option("--display-name <displayName>", "Human-readable name")
    .option("--description <description>", "Short description")
    .action(async (options) => {
        console.log(ui.title("Creating Asset"));

        try {
            const kind = options.kind as string;
            if (!isCreatableAssetKind(kind)) {
                throw new Error(`Invalid kind '${kind}'. Must be one of: ${CREATABLE_ASSET_KINDS.join(", ")}`);
            }
            const typedKind: CreatableAssetKind = kind;

            const slug = options.name as string;
            if (!/^[a-z0-9][a-z0-9._-]{1,98}[a-z0-9]$/.test(slug)) {
                throw new Error(
                    `Invalid slug '${slug}'. Use lowercase letters, numbers, hyphens, dots only (2-100 chars).`
                );
            }

            // Resolve author: --author flag > logged-in GitHub username
            let author = options.author as string | undefined;
            if (!author) {
                const auth = await getAuthUser();
                if (auth) {
                    author = auth.username;
                } else {
                    throw new Error(
                        `No author specified.\n` +
                        `  Option 1: dot login  (uses your GitHub username automatically)\n` +
                        `  Option 2: dot create --author <name> --kind ${typedKind} --name ${slug}`
                    );
                }
            }

            const cwd = process.cwd();
            const dotDir = getDotDir(cwd);
            if (!fs.existsSync(dotDir)) {
                throw new Error("Workspace not initialised. Run 'dot init' first.");
            }

            const urn = `${typedKind}/@${author}/${slug}`;
            const filePath = assetFilePath(cwd, urn);
            if (fs.existsSync(filePath)) {
                throw new Error(
                    `Asset already exists at '${filePath}'.\n` +
                    `  Edit it directly or delete it to recreate.`
                );
            }

            const displayName = options.displayName || slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
            const description = options.description || `Asset for ${displayName}`;

            let template: Record<string, unknown>;
            if (typedKind === "tal") template = buildTalTemplate(author, slug, description);
            else if (typedKind === "dance") template = buildDanceTemplate(author, slug, description);
            else if (typedKind === "performer") template = buildPerformerTemplate(author, slug, description);
            else template = buildActTemplate(slug, description, author);

            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(template, null, 2), "utf-8");

            console.log(ui.success(`\n✔ Created ${urn}`));
            console.log(ui.dim(`  Saved to: ${filePath}`));
            console.log(ui.dim(`\n  Edit the file to customise, then publish:`));
            console.log(ui.dim(`    dot publish --kind ${typedKind} --name ${slug}`));


        } catch (err: any) {
            console.error(ui.error(`Create failed: ${err.message}`));
            process.exit(1);
        }
    });
