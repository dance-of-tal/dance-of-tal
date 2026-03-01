import { Command } from "commander";
import { ui } from "../utils/ui.js";

const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal-v2.workers.dev";

const ALL_CATEGORIES = ["tal", "dance", "act", "combo"] as const;

interface PackageMeta {
    urn: string;
    category: string;
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
    .option("--category <category>", "Filter by category: tal | dance | act | combo")
    .action(async (keyword: string, options) => {
        console.log(ui.title(`Searching registry for: "${keyword}"`));

        const categories = options.category
            ? [options.category as string]
            : [...ALL_CATEGORIES];

        const validCategories = [...ALL_CATEGORIES] as string[];
        if (options.category && !validCategories.includes(options.category)) {
            console.error(ui.error(`Invalid category. Must be one of: ${validCategories.join(", ")}`));
            process.exit(1);
        }

        try {
            const results: PackageMeta[] = [];

            await Promise.all(
                categories.map(async (category) => {
                    const url = `${REGISTRY_URL}/packages?category=${category}`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`Registry error for category '${category}': ${res.statusText}`);
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

            // Group by category
            const byCategory: Record<string, PackageMeta[]> = {};
            for (const pkg of results) {
                if (!byCategory[pkg.category]) byCategory[pkg.category] = [];
                byCategory[pkg.category].push(pkg);
            }

            console.log(ui.dim(`\nFound ${results.length} result(s):\n`));

            for (const [cat, pkgs] of Object.entries(byCategory)) {
                console.log(ui.section(`  [${cat.toUpperCase()}]`));
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
