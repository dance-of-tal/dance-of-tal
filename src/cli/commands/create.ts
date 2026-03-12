import { Command } from "commander";
import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";
import { getDotDir, assetFilePath } from "../../lib/registry.js";
import { getAuthUser } from "./login.js";
import { CREATABLE_ASSET_KINDS, CreatableAssetKind, isCreatableAssetKind } from "../../lib/kinds.js";

const CREATABLE_KIND_HELP = CREATABLE_ASSET_KINDS.join(", ");

function buildTalTemplate(author: string, slug: string, name: string, description: string): Record<string, unknown> {
    return {
        type: `tal/@${author}/${slug}`,
        slug,
        name,
        description,
        tags: [],
        featuredScore: 0,
        createdAt: new Date().toISOString().split("T")[0],
        content: "Add your thinking model here.\n\nCore principles:\n- ...\n\nDo:\n- ...\n\nDo not:\n- ..."
    };
}

function buildDanceTemplate(author: string, slug: string, name: string, description: string): Record<string, unknown> {
    return {
        type: `dance/@${author}/${slug}`,
        slug,
        name,
        description,
        tags: [],
        content: "Tone:\n- ...\nStructure:\n- ...\nFormatting:\n- ...\nForbidden:\n- ..."
    };
}

function buildActTemplate(slug: string, name: string, description: string, author: string): Record<string, unknown> {
    return {
        type: `act/@${author}/${slug}`,
        slug,
        name,
        description,
        tags: [],
        entryNode: "orchestrate",
        nodes: {
            "orchestrate": {
                type: "orchestrator",
                performer: `performer/@${author}/your-orchestrator`,
                maxDelegations: 10
            },
            "worker-1": {
                type: "worker",
                performer: `performer/@${author}/your-worker`
            }
        },
        edges: [
            {
                from: "orchestrate",
                to: "worker-1"
            }
        ],
        maxIterations: 50
    };
}

function buildPerformerTemplate(author: string, slug: string): Record<string, unknown> {
    return {
        type: `performer/@${author}/${slug}`,
        tags: [],
        tal: `tal/@${author}/your-tal`,
        dance: [`dance/@${author}/your-dance`],
        model: "claude-sonnet-4-20250514"
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
            const description = options.description || `${displayName}`;

            let template: Record<string, unknown>;
            if (typedKind === "tal") template = buildTalTemplate(author, slug, displayName, description);
            else if (typedKind === "dance") template = buildDanceTemplate(author, slug, displayName, description);
            else if (typedKind === "performer") template = buildPerformerTemplate(author, slug);
            else template = buildActTemplate(slug, displayName, description, author);

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
