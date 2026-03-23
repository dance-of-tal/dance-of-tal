import { Command } from "commander";
import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";
import { getDotDir, assetFilePath } from "../../lib/registry.js";
import { getAuthUser } from "./login.js";
import { CREATABLE_ASSET_KINDS, isCreatableAssetKind } from "../../lib/kinds.js";
import type { CreatableAssetKind } from "../../lib/kinds.js";

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



function buildTalTemplate(owner: string, stage: string, name: string, description: string): Record<string, unknown> {
    return {
        kind: "tal",
        urn: `tal/@${owner}/${stage}/${name}`,
        description,
        tags: [],
        payload: {
            content: defaultTalMarkdown(),
        },
    };
}

function buildActTemplate(owner: string, stage: string, name: string, description: string): Record<string, unknown> {
    return {
        kind: "act",
        urn: `act/@${owner}/${stage}/${name}`,
        description,
        tags: [],
        payload: {
            actRules: [
                "Lead owns final approval.",
            ],
            participants: [
                {
                    key: "lead",
                    performer: `performer/@${owner}/${stage}/your-lead`,
                    subscriptions: {
                        callboardKeys: ["shared/*"]
                    }
                },
                {
                    key: "worker",
                    performer: `performer/@${owner}/${stage}/your-worker`
                }
            ],
            relations: [
                {
                    between: ["lead", "worker"],
                    direction: "one-way",
                    name: "review_request",
                    description: "Lead coordinates, worker executes.",
                }
            ],
        },
    };
}

function buildPerformerTemplate(owner: string, stage: string, name: string, description: string): Record<string, unknown> {
    return {
        kind: "performer",
        urn: `performer/@${owner}/${stage}/${name}`,
        description,
        tags: [],
        payload: {
            tal: `tal/@${owner}/${stage}/your-tal`,
            dances: [`dance/@${owner}/${stage}/your-dance`],
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
    .requiredOption("--name <slug>", "Asset name (e.g. my-custom-tal)")
    .requiredOption("--stage <stage>", "Stage/project group (e.g. agent-presets)")
    .option("--author <author>", "Owner namespace (defaults to logged-in GitHub username)")
    .option("--description <description>", "Short description")
    .action(async (options) => {
        console.log(ui.title("Creating Asset"));

        try {
            const kind = options.kind as string;
            if (!isCreatableAssetKind(kind)) {
                throw new Error(`Invalid kind '${kind}'. Must be one of: ${CREATABLE_ASSET_KINDS.join(", ")}`);
            }
            const typedKind: CreatableAssetKind = kind;

            // Dance creates a SKILL.md directory, not a JSON file
            if (typedKind === "dance") {
                throw new Error(
                    "Dance assets use SKILL.md format. Use 'dot init dance' to scaffold a new Dance skill."
                );
            }

            const name = options.name as string;
            if (!/^[a-z0-9][a-z0-9._-]{1,98}[a-z0-9]$/.test(name)) {
                throw new Error(
                    `Invalid name '${name}'. Use lowercase letters, numbers, hyphens, dots only (2-100 chars).`
                );
            }

            const stage = options.stage as string;
            if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(stage)) {
                throw new Error(`Invalid stage '${stage}'.`);
            }

            // Resolve owner: --author flag > logged-in GitHub username
            let owner = options.author as string | undefined;
            if (!owner) {
                const auth = await getAuthUser();
                if (auth) {
                    owner = auth.username;
                } else {
                    throw new Error(
                        `No author specified.\n` +
                        `  Option 1: dot login  (uses your GitHub username automatically)\n` +
                        `  Option 2: dot create --author <name> --kind ${typedKind} --stage ${stage} --name ${name}`
                    );
                }
            }

            const cwd = process.cwd();
            const dotDir = getDotDir(cwd);
            if (!fs.existsSync(dotDir)) {
                throw new Error("Workspace not initialised. Run 'dot init' first.");
            }

            const urn = `${typedKind}/@${owner}/${stage}/${name}`;
            const filePath = assetFilePath(cwd, urn);
            if (fs.existsSync(filePath)) {
                throw new Error(
                    `Asset already exists at '${filePath}'.\n` +
                    `  Edit it directly or delete it to recreate.`
                );
            }

            const humanName = name.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
            const description = options.description || `Asset for ${humanName}`;

            let template: Record<string, unknown>;
            if (typedKind === "tal") template = buildTalTemplate(owner, stage, name, description);
            else if (typedKind === "performer") template = buildPerformerTemplate(owner, stage, name, description);
            else template = buildActTemplate(owner, stage, name, description);

            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(template, null, 2), "utf-8");

            console.log(ui.success(`\n✔ Created ${urn}`));
            console.log(ui.dim(`  Saved to: ${filePath}`));
            console.log(ui.dim(`\n  Edit the file to customise, then publish:`));
            console.log(ui.dim(`    dot publish --kind ${typedKind} --stage ${stage} --name ${name}`));


        } catch (err: any) {
            console.error(ui.error(`Create failed: ${err.message}`));
            process.exit(1);
        }
    });
