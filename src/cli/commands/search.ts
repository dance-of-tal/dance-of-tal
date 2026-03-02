import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { ASSET_KINDS, isAssetKind } from "../../lib/kinds.js";

const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal-v2.workers.dev";
const ASSET_KIND_HELP = ASSET_KINDS.join(" | ");

interface PackageMeta {
    urn: string;
    kind: string;
    name: string;
    author: string;
    version: string;
    description: string;
    tags: string[];
    updatedAt: string;
}

function matchesKeyword(pkg: PackageMeta, keyword: string): boolean {
    const q = keyword.toLowerCase();
    return (
        pkg.urn.toLowerCase().includes(q) ||
        pkg.name.toLowerCase().includes(q) ||
        pkg.author.toLowerCase().includes(q) ||
        (pkg.description || "").toLowerCase().includes(q) ||
        (pkg.tags || []).some((t) => t.toLowerCase().includes(q))
    );
}

export const searchCmd = new Command("search")
    .description("Search the global registry for assets by keyword")
    .argument("<keyword>", "Keyword to search for (matches URN, name, author, description, tags)")
    .option("--kind <kind>", `Filter by kind: ${ASSET_KIND_HELP}`)
    .action(async (keyword: string, options) => {
        console.log(ui.title(`Searching registry for: "${keyword}"`));

        const kinds = options.kind
            ? [options.kind as string]
            : [...ASSET_KINDS];

        if (options.kind && !isAssetKind(options.kind)) {
            console.error(ui.error(`Invalid kind. Must be one of: ${ASSET_KINDS.join(", ")}`));
            process.exit(1);
        }

        try {
            const results: PackageMeta[] = [];

            await Promise.all(
                kinds.map(async (kind) => {
                    const url = `${REGISTRY_URL}/registry?kind=${kind}`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`Registry error for kind '${kind}': ${res.statusText}`);
                    const data: any = await res.json();
                    const packages: PackageMeta[] = (data.packages || []).filter(Boolean);
                    const matched = packages.filter((pkg) => matchesKeyword(pkg, keyword));
                    results.push(...matched);
                })
            );

            if (results.length === 0) {
                console.log(ui.warning(`\nNo results found for "${keyword}".`));
                return;
            }

            // Group by asset kind
            const byKind: Record<string, PackageMeta[]> = {};
            for (const pkg of results) {
                if (!byKind[pkg.kind]) byKind[pkg.kind] = [];
                byKind[pkg.kind].push(pkg);
            }

            console.log(ui.dim(`\nFound ${results.length} result(s):\n`));

            for (const [kind, pkgs] of Object.entries(byKind)) {
                console.log(ui.section(`  [${kind.toUpperCase()}]`));
                for (const pkg of pkgs) {
                    console.log(`    ${ui.highlight(pkg.urn)}`);
                    if (pkg.description) console.log(`      ${ui.dim(pkg.description)}`);
                    if (pkg.tags?.length) console.log(`      ${ui.dim("tags: " + pkg.tags.join(", "))}`);
                    console.log(`      ${ui.dim("install: dot install " + pkg.urn)}`);
                    console.log("");
                }
            }
        } catch (err: any) {
            console.error(ui.error(`Search failed: ${err.message}`));
            process.exit(1);
        }
    });
