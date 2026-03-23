import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { ASSET_KINDS, isAssetKind } from "../../lib/kinds.js";
import { searchRegistry } from "../../lib/registry-api.js";
import type { RegistryPackageMeta } from "../../lib/registry-api.js";

const ASSET_KIND_HELP = ASSET_KINDS.join(" | ");

export const searchCmd = new Command("search")
    .description("Search the global registry for assets by keyword")
    .argument("<keyword>", "Keyword to search for (matches URN, name, author, description, tags)")
    .option("--kind <kind>", `Filter by kind: ${ASSET_KIND_HELP}`)
    .option("--tag <tag>", "Filter by tag")
    .action(async (keyword: string, options) => {
        console.log(ui.title(`Searching registry for: "${keyword}"`));

        if (options.kind && !isAssetKind(options.kind)) {
            console.error(ui.error(`Invalid kind. Must be one of: ${ASSET_KINDS.join(", ")}`));
            process.exit(1);
        }

        try {
            const results = await searchRegistry(keyword, {
                kind: options.kind,
                tag: options.tag,
                limit: 50,
            });

            if (results.length === 0) {
                console.log(ui.warning(`\nNo results found for "${keyword}".`));
                return;
            }

            // Group by asset kind
            const byKind: Record<string, RegistryPackageMeta[]> = {};
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
