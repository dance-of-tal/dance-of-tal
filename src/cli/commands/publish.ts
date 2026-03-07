import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getAuthUser } from "./login.js";
import { assetFilePath } from "../../lib/registry.js";
import fs from "fs/promises";
import { ASSET_KINDS, isAssetKind } from "../../lib/kinds.js";
import readline from "readline";

const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal.workers.dev";
const ASSET_KIND_HELP = ASSET_KINDS.join(", ");

type DepInfo = {
    urn: string;
    status: "exists" | "to_publish" | "foreign_missing";
    payload?: Record<string, unknown>;
};

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Parse a URN like "tal/@bob/cool-persona" into { kind, author, name }.
 */
export function parseUrn(urn: string): { kind: string; author: string; name: string } | null {
    const parts = urn.split("/");
    if (parts.length !== 3 || !parts[1].startsWith("@")) return null;
    return { kind: parts[0], author: parts[1].slice(1), name: parts[2] };
}

/**
 * Check if an asset exists in the remote registry.
 */
async function existsInRegistry(urn: string): Promise<boolean> {
    const parsed = parseUrn(urn);
    if (!parsed) return false;
    try {
        const res = await fetch(`${REGISTRY_URL}/registry/${parsed.kind}/${parsed.author}/${parsed.name}`);
        if (!res.ok) return false;
        const data: any = await res.json();
        return data.success === true && !!data.package;
    } catch {
        return false;
    }
}

/**
 * Loads a locally installed asset by URN.
 */
async function loadLocalAssetByUrn(cwd: string, urn: string): Promise<Record<string, unknown> | null> {
    try {
        const filePath = assetFilePath(cwd, urn);
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw) as Record<string, unknown>;
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        throw err;
    }
}

export function getPayloadTags(payload: Record<string, unknown>): string[] {
    if (!Array.isArray(payload.tags)) return [];
    return payload.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
}

export async function loadPublishPayload(
    cwd: string,
    kind: string,
    name: string,
    username: string
): Promise<Record<string, unknown>> {
    const slug = name.includes("/") ? name.split("/").pop()! : name;
    if (kind === "performer") {
        const urn = `performer/@${username}/${slug}`;
        const performer = await loadLocalAssetByUrn(cwd, urn);
        if (!performer) {
            throw new Error(
                `Performer asset not found at '${assetFilePath(cwd, urn)}'.\n` +
                `  Create or install the asset first, then publish it.`
            );
        }
        return performer;
    }

    return loadLocalAsset(cwd, kind, name, username);
}

export function resolveTagsOption(optionsTags: string | undefined, payload: Record<string, unknown>): string[] {
    if (!optionsTags) return getPayloadTags(payload);
    return optionsTags.split(",").map((tag: string) => tag.trim()).filter(Boolean);
}

export async function resolveDependencies(
    cwd: string,
    kind: string,
    payload: Record<string, unknown>,
    myUsername: string
): Promise<DepInfo[]> {
    const result: DepInfo[] = [];
    const visited = new Set<string>();

    async function resolve(urn: string): Promise<void> {
        if (visited.has(urn)) return;
        visited.add(urn);

        const parsed = parseUrn(urn);
        if (!parsed) return;

        if (await existsInRegistry(urn)) {
            result.push({ urn, status: "exists" });
            return;
        }

        const isMine = parsed.author.toLowerCase() === myUsername.toLowerCase();
        if (!isMine) {
            result.push({ urn, status: "foreign_missing" });
            return;
        }

        const depPayload = await loadLocalAssetByUrn(cwd, urn);
        if (!depPayload) {
            result.push({ urn, status: "foreign_missing" });
            return;
        }

        const subDeps = extractDependencyUrns(parsed.kind, depPayload);
        for (const subUrn of subDeps) {
            await resolve(subUrn);
        }

        result.push({ urn, status: "to_publish", payload: depPayload });
    }

    const directDeps = extractDependencyUrns(kind, payload);
    for (const depUrn of directDeps) {
        await resolve(depUrn);
    }

    return result;
}

export function extractDependencyUrns(kind: string, payload: Record<string, unknown>): string[] {
    const urns: string[] = [];

    if (kind === "performer") {
        if (typeof payload.tal === "string") urns.push(payload.tal);
        const dance = payload.dance;
        if (typeof dance === "string") {
            urns.push(dance);
        } else if (Array.isArray(dance)) {
            for (const d of dance) {
                if (typeof d === "string") urns.push(d);
            }
        }
    } else if (kind === "act") {
        const nodes = payload.nodes;
        if (typeof nodes === "object" && nodes !== null) {
            for (const node of Object.values(nodes as Record<string, any>)) {
                if (typeof node === "object" && node !== null && typeof node.performer === "string") {
                    urns.push(node.performer);
                }
            }
        }
    }

    return urns;
}

/**
 * Loads a locally installed asset using the logged-in author's namespace.
 */
async function loadLocalAsset(
    cwd: string,
    kind: string,
    name: string,
    username: string
): Promise<Record<string, unknown>> {
    const slug = name.includes("/") ? name.split("/").pop()! : name;
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

/**
 * Publish a single asset to the registry.
 */
async function publishSingleAsset(
    kind: string,
    slug: string,
    payload: Record<string, unknown>,
    tags: string[],
    token: string
): Promise<boolean> {
    const res = await fetch(`${REGISTRY_URL}/publish`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kind, name: slug, tags, payload }),
    });

    if (!res.ok) {
        const errorData: any = await res.json().catch(() => ({}));
        if (res.status === 409) {
            return false;
        }
        throw new Error(errorData.error || res.statusText);
    }

    const result: any = await res.json();
    if (!result.success) {
        throw new Error(result.error || "Unknown error occurred");
    }
    return true;
}

/**
 * Prompt user for confirmation.
 */
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
            const auth = await getAuthUser();
            if (!auth) {
                throw new Error("You are not logged in. Please run `dot login` first.");
            }

            if (!isAssetKind(options.kind)) {
                throw new Error(`Invalid kind. Must be one of: ${ASSET_KINDS.join(", ")}`);
            }

            const cwd = process.cwd();
            const payload = await loadPublishPayload(cwd, options.kind, options.name, auth.username);

            const tagsArray = resolveTagsOption(options.tags, payload);

            const slug = options.name.includes("/") ? options.name.split("/").pop()! : options.name;
            const mainUrn = `${options.kind}/@${auth.username}/${slug}`;

            if (options.kind === "performer" || options.kind === "act") {
                console.log(ui.dim("\nResolving dependencies..."));
                const deps = await resolveDependencies(cwd, options.kind, payload, auth.username);

                const toPublish = deps.filter((dep) => dep.status === "to_publish");
                const foreignMissing = deps.filter((dep) => dep.status === "foreign_missing");
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
                        console.log(ui.dim(`  Publishing ${dep.urn}...`));
                        const depTags = getPayloadTags(dep.payload);
                        const published = await publishSingleAsset(parsed.kind, parsed.name, dep.payload, depTags, auth.token);
                        console.log(published ? ui.success(`  ✔ ${dep.urn}`) : ui.dim(`  ⏭ ${dep.urn} already exists, skipped`));
                    }
                }
            }

            console.log(ui.dim(`\nPublishing ${mainUrn}...`));
            const published = await publishSingleAsset(options.kind, slug, payload, tagsArray, auth.token);
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
