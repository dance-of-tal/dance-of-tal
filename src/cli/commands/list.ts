import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getAuthUser } from "./login.js";

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

export const listCmd = new Command("list")
    .description("List packages from the registry")
    .option("--mine", "Show only packages published by the logged-in user")
    .option("--category <category>", "Filter by category: tal | dance | act | combo")
    .action(async (options) => {
        try {
            const categories = options.category
                ? [options.category as string]
                : [...ALL_CATEGORIES];

            const validCategories = [...ALL_CATEGORIES] as string[];
            if (options.category && !validCategories.includes(options.category)) {
                console.error(ui.error(`Invalid category. Must be one of: ${validCategories.join(", ")}`));
                process.exit(1);
            }

            let username: string | null = null;

            if (options.mine) {
                const auth = await getAuthUser();
                if (!auth) {
                    console.error(ui.error("You are not logged in. Run `dot login` first."));
                    process.exit(1);
                }
                username = auth.username;
                console.log(ui.title(`Packages by @${username}`));
            } else {
                console.log(ui.title("Registry Packages"));
            }

            const allPackages: PackageMeta[] = [];

            await Promise.all(
                categories.map(async (category) => {
                    const res = await fetch(`${REGISTRY_URL}/packages?category=${category}`);
                    if (!res.ok) throw new Error(`Registry error for '${category}': ${res.statusText}`);
                    const data: any = await res.json();
                    const packages: PackageMeta[] = (data.packages || []).filter(Boolean);
                    allPackages.push(...packages);
                })
            );

            // Filter by author if --mine
            const filtered = username
                ? allPackages.filter((p) => p.author === username)
                : allPackages;

            if (filtered.length === 0) {
                if (username) {
                    console.log(ui.warning(`\nNo packages found for @${username}.`));
                    console.log(ui.dim("Publish your first asset with: dot publish --category tal --name <slug>"));
                } else {
                    console.log(ui.warning("\nNo packages found in registry."));
                }
                return;
            }

            // Group by category
            const byCategory: Record<string, PackageMeta[]> = {};
            for (const pkg of filtered) {
                if (!byCategory[pkg.category]) byCategory[pkg.category] = [];
                byCategory[pkg.category].push(pkg);
            }

            console.log(ui.dim(`\n${filtered.length} package(s) found:\n`));

            for (const [cat, pkgs] of Object.entries(byCategory)) {
                console.log(ui.section(`  [${cat.toUpperCase()}]  (${pkgs.length})`));
                for (const pkg of pkgs) {
                    const versionStr = pkg.version ? ui.dim(` v${pkg.version}`) : "";
                    console.log(`    ${ui.highlight(pkg.urn)}${versionStr}`);
                    if (pkg.description) console.log(`      ${ui.dim(pkg.description)}`);
                    if (pkg.tags?.length) console.log(`      ${ui.dim("tags: " + pkg.tags.join(", "))}`);
                    console.log("");
                }
            }
        } catch (err: any) {
            console.error(ui.error(`List failed: ${err.message}`));
            process.exit(1);
        }
    });
