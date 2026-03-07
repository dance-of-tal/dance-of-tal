import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { getAuthUser } from "./login.js";
import { ASSET_KINDS, isAssetKind } from "../../lib/kinds.js";
import { listRegistryPackages, RegistryPackageMeta } from "../../lib/installer.js";

const ASSET_KIND_HELP = ASSET_KINDS.join(" | ");

export const listCmd = new Command("list")
    .description("List packages from the registry")
    .option("--mine", "Show only packages published by the logged-in user")
    .option("--kind <kind>", `Filter by kind: ${ASSET_KIND_HELP}`)
    .action(async (options) => {
        try {
            if (options.kind && !isAssetKind(options.kind)) {
                console.error(ui.error(`Invalid kind. Must be one of: ${ASSET_KINDS.join(", ")}`));
                process.exit(1);
            }

            const kinds = options.kind ? [options.kind as string] : [...ASSET_KINDS];
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

            const allPackages = await listRegistryPackages({ kinds });

            // Filter by author if --mine
            const filtered = username
                ? allPackages.filter((p) => p.author === username)
                : allPackages;

            if (filtered.length === 0) {
                if (username) {
                    console.log(ui.warning(`\nNo packages found for @${username}.`));
                    console.log(ui.dim("Publish your first asset with: dot publish --kind tal --name <slug>"));
                } else {
                    console.log(ui.warning("\nNo packages found in registry."));
                }
                return;
            }

            // Group by asset kind
            const byKind: Record<string, RegistryPackageMeta[]> = {};
            for (const pkg of filtered) {
                if (!byKind[pkg.kind]) byKind[pkg.kind] = [];
                byKind[pkg.kind].push(pkg);
            }

            console.log(ui.dim(`\n${filtered.length} package(s) found:\n`));

            for (const [kind, pkgs] of Object.entries(byKind)) {
                console.log(ui.section(`  [${kind.toUpperCase()}]  (${pkgs.length})`));
                for (const pkg of pkgs) {
                    console.log(`    ${ui.highlight(pkg.urn)}`);
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
