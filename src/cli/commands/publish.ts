import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getAuthUser } from "./login.js";
import { assetFilePath } from "../../lib/registry.js";
import fs from "fs/promises";
import { isAssetKind } from "../../lib/kinds.js";
import readline from "readline";
import {
    getPayloadTags,
    loadLocalAssetByUrn,
    parseUrn,
    publishSingleAsset,
    resolveDependencies,
} from "../../lib/publishing.js";
import { parseDotAsset } from "../../contracts/index.js";

const PUBLISHABLE_KINDS = ["tal", "performer", "act"] as const;
const PUBLISHABLE_KIND_HELP = PUBLISHABLE_KINDS.join(", ");


// ── Helpers ──────────────────────────────────────────────────────────

export async function loadPublishPayload(
    cwd: string,
    kind: string,
    stage: string,
    name: string,
    username: string
): Promise<Record<string, unknown>> {
    if (kind === "performer") {
        const urn = `performer/@${username}/${stage}/${name}`;
        const performer = await loadLocalAssetByUrn(cwd, urn);
        if (!performer) {
            throw new Error(
                `Performer asset not found at '${assetFilePath(cwd, urn)}'.\n` +
                `  Create or install the asset first, then publish it.`
            );
        }
        return performer;
    }

    return loadLocalAsset(cwd, kind, stage, name, username);
}

export function resolveTagsOption(optionsTags: string | undefined, payload: Record<string, unknown>): string[] {
    if (!optionsTags) return getPayloadTags(payload);
    return optionsTags.split(",").map((tag: string) => tag.trim()).filter(Boolean);
}

async function loadLocalAsset(
    cwd: string,
    kind: string,
    stage: string,
    name: string,
    username: string
): Promise<Record<string, unknown>> {
    const urn = `${kind}/@${username}/${stage}/${name}`;
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

function confirm(message: string): Promise<boolean> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(message, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() !== "n");
        });
    });
}

// ── Command ──────────────────────────────────────────────────────────

export const publishCmd = new Command("publish")
    .description("Publish a Tal, Performer, or Act asset to the remote registry (Dance uses dot add)")
    .requiredOption("--kind <kind>", `The type of asset: ${PUBLISHABLE_KIND_HELP}`)
    .requiredOption("--name <name>", "Asset name")
    .requiredOption("--stage <stage>", "Stage/project group")
    .option("--tags <tags>", "Comma-separated list of tags (e.g. 'frontend,react,architect')")
    .action(async (options) => {
        console.log(ui.title("Publishing Asset to Registry"));

        try {
            if (options.kind === "dance") {
                throw new Error(
                    "Dance assets cannot be published directly.\n" +
                    "  Dance uses SKILL.md format from GitHub repos.\n" +
                    "  Use 'dot add <owner/repo>' to install and auto-register."
                );
            }

            const auth = await getAuthUser();
            if (!auth) {
                throw new Error("You are not logged in. Please run `dot login` first.");
            }

            if (!isAssetKind(options.kind)) {
                throw new Error(`Invalid kind. Must be one of: ${PUBLISHABLE_KIND_HELP}`);
            }

            // ── ToS agreement ────────────────────────────────────────
            console.log(
                ui.dim("\n  By publishing, you agree to the Dance of Tal Terms of Service:") +
                "\n  " + ui.highlight("https://danceoftal.com/tos") + "\n"
            );
            const agreed = await confirm("  Proceed? [Y/n] ");
            if (!agreed) {
                console.log(ui.dim("  Cancelled."));
                return;
            }

            const cwd = process.cwd();
            const stage = options.stage as string;
            const name = options.name as string;
            const payload = await loadPublishPayload(cwd, options.kind, stage, name, auth.username);

            // Validate canonical contract before sending to registry
            parseDotAsset(payload);

            const tagsArray = resolveTagsOption(options.tags, payload);
            const mainUrn = `${options.kind}/@${auth.username}/${stage}/${name}`;

            if (options.kind === "performer" || options.kind === "act") {
                console.log(ui.dim("\nResolving dependencies..."));
                const deps = await resolveDependencies(cwd, options.kind, payload, auth.username);

                const toPublish = deps.filter((dep) => dep.status === "to_publish");
                const foreignMissing = deps.filter((dep) => dep.status === "foreign_missing");
                const localMissing = deps.filter((dep) => dep.status === "local_missing");
                const existing = deps.filter((dep) => dep.status === "exists");

                if (existing.length > 0) {
                    console.log(ui.dim(`  Already in registry: ${existing.map((dep) => dep.urn).join(", ")}`));
                }

                if (foreignMissing.length > 0) {
                    throw new Error(
                        `Cannot publish: the following dependencies are not in the registry and belong to other authors:\n` +
                        foreignMissing.map((dep) => `  - ${dep.urn}`).join("\n") +
                        `\n\nAsk the respective authors to publish them first.`
                    );
                }

                if (localMissing.length > 0) {
                    throw new Error(
                        `Cannot publish: the following dependencies belong to you but are not found locally:\n` +
                        localMissing.map((dep) => `  - ${dep.urn}`).join("\n") +
                        `\n\nCreate or install them first with 'dot create' or 'dot install'.`
                    );
                }

                if (toPublish.length > 0) {
                    console.log(ui.section("\nDependencies to publish:"));
                    toPublish.forEach((dep, index) => {
                        console.log(`  ${index + 1}. ${ui.highlight(dep.urn)}`);
                    });
                    console.log(`  ${toPublish.length + 1}. ${ui.highlight(mainUrn)} ${ui.dim("(main)")}`);

                    const proceed = await confirm(`\n  Publish ${toPublish.length + 1} assets? [Y/n] `);
                    if (!proceed) {
                        console.log(ui.dim("  Cancelled."));
                        return;
                    }

                    for (const dep of toPublish) {
                        const parsed = parseUrn(dep.urn);
                        if (!parsed || !dep.payload) continue;
                        parseDotAsset(dep.payload);
                        console.log(ui.dim(`  Publishing ${dep.urn}...`));
                        const depTags = getPayloadTags(dep.payload);
                        const published = await publishSingleAsset(parsed.kind, parsed.stage, parsed.name, dep.payload, depTags, auth.token);
                        console.log(published ? ui.success(`  ✔ ${dep.urn}`) : ui.dim(`  ⏭ ${dep.urn} already exists, skipped`));
                    }
                }
            }

            console.log(ui.dim(`\nPublishing ${mainUrn}...`));
            const published = await publishSingleAsset(options.kind, stage, name, payload, tagsArray, auth.token);
            if (published) {
                console.log(ui.success(`\n✔ Published ${mainUrn}`));
            } else {
                console.log(ui.warning(`\n⏭ ${mainUrn} already exists in the registry. Skipped.`));
            }
        } catch (err: any) {
            console.error(ui.error(`Publish failed: ${err.message}`));
            process.exit(1);
        }
    });
