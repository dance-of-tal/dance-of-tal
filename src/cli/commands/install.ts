import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";
import { getDotDir, assetFilePath } from "../../lib/registry.js";

const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal-v2.workers.dev";

/**
 * Fetches a single asset from the registry and saves it locally.
 * Skips silently if already installed (unless `force` is true).
 */
async function installSingleAsset(pkg: string, force = false): Promise<void> {
    const parts = pkg.split("/");

    const dotDir = getDotDir(process.cwd());
    if (!fs.existsSync(dotDir)) {
        throw new Error("Workspace not initialised. Run 'dot init' first.");
    }

    const filePath = assetFilePath(process.cwd(), pkg);

    // Skip if already installed
    if (!force && fs.existsSync(filePath)) {
        console.log(ui.dim(`  ↳ Already installed, skipping: ${pkg}`));
        return;
    }

    const url = `${REGISTRY_URL}/packages/${parts[0]}/${parts[1]}/${parts[2]}`;
    console.log(ui.dim(`  Fetching ${url}...`));

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) throw new Error(`Package '${pkg}' not found in registry.`);
        throw new Error(`Registry error: ${res.statusText}`);
    }

    const { success, package: pkgData } = (await res.json()) as any;
    if (!success || !pkgData) throw new Error("Invalid response from registry.");

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(pkgData.content, null, 2));

    console.log(ui.success(`  ✔ Installed ${pkg}`));
    console.log(ui.dim(`    Saved to: ${filePath}`));
}

export async function runInstall(pkg: string) {
    // Validate URN format: category/@author/name
    const parts = pkg.split("/");
    if (parts.length !== 3 || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid URN format: '${pkg}'\n` +
            `  Expected: <category>/@<author>/<name>\n` +
            `  Example:  tal/@dot-presets/gpt-architecture-review`
        );
    }

    const [category] = parts;
    const validCategories = ["tal", "dance", "act", "combo"];
    if (!validCategories.includes(category)) {
        throw new Error(`Invalid category: '${category}'. Allowed: ${validCategories.join(", ")}`);
    }

    console.log(ui.title(`Installing package: ${pkg}`));

    try {
        if (category === "combo" || category === "act") {
            // --- Cascading install ---
            // 1. Fetch the asset itself
            const url = `${REGISTRY_URL}/packages/${parts[0]}/${parts[1]}/${parts[2]}`;
            console.log(ui.dim(`Fetching ${category} from ${url}...`));

            const res = await fetch(url);
            if (!res.ok) {
                if (res.status === 404) throw new Error(`Package '${pkg}' not found in registry.`);
                throw new Error(`Registry error: ${res.statusText}`);
            }

            const { success, package: pkgData } = (await res.json()) as any;
            if (!success || !pkgData) throw new Error("Invalid response from registry.");

            const content = pkgData.content as Record<string, unknown>;

            // 2. Save the file itself
            const dotDir = getDotDir(process.cwd());
            if (!fs.existsSync(dotDir)) {
                throw new Error("Workspace not initialised. Run 'dot init' first.");
            }
            const filePath = assetFilePath(process.cwd(), pkg);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
            console.log(ui.success(`\n✔ Installed ${category}: ${pkg}`));

            if (category === "combo") {
                // 3. Cascading install for Combo: tal
                const talUrn = typeof content.tal === "string" ? content.tal : null;
                if (talUrn) {
                    console.log(ui.dim(`\nInstalling tal dependency: ${talUrn}`));
                    await installSingleAsset(talUrn);
                }

                // 4. Cascading install for Combo: dance (single or array)
                const danceRaw = content.dance;
                const danceUrns: string[] = Array.isArray(danceRaw)
                    ? (danceRaw as unknown[]).filter((d): d is string => typeof d === "string")
                    : typeof danceRaw === "string"
                        ? [danceRaw]
                        : [];

                if (danceUrns.length > 0) {
                    console.log(ui.dim(`\nInstalling dance dependenc${danceUrns.length > 1 ? "ies" : "y"}:`));
                    for (const danceUrn of danceUrns) {
                        await installSingleAsset(danceUrn);
                    }
                }

                // 5. Cascading install for Combo: act (optional)
                const actUrn = typeof content.act === "string" ? content.act : null;
                if (actUrn) {
                    console.log(ui.dim(`\nInstalling act dependency: ${actUrn}`));
                    await installSingleAsset(actUrn);
                }

                console.log(ui.success(`\n✔ All dependencies installed for combo '${parts[2]}'.`));
                console.log(ui.dim(`  To use this combo, run: dot switch ${parts[2]}`));
                console.log(ui.dim(`  Or lock it: dot lock --tal ${talUrn ?? "<tal>"} --dance ${danceUrns.join(",")} --name ${parts[2]}`));
            } else if (category === "act") {
                // Cascading install for Act: iterate through nodes
                const nodes = content.nodes as Record<string, any>;
                if (nodes) {
                    let depCount = 0;
                    const seen = new Set<string>();
                    console.log(ui.dim(`\nInspecting act nodes for dependencies...`));

                    for (const [nodeId, nodeValue] of Object.entries(nodes)) {
                        const talUrn = typeof nodeValue.tal === "string" ? nodeValue.tal : null;
                        const danceRaw = nodeValue.dance;
                        const danceUrns: string[] = Array.isArray(danceRaw)
                            ? (danceRaw as unknown[]).filter((d): d is string => typeof d === "string")
                            : typeof danceRaw === "string"
                                ? [danceRaw]
                                : [];

                        if (talUrn && !seen.has(talUrn)) {
                            console.log(ui.dim(`\nNode [${nodeId}]: installing tal ${talUrn}`));
                            await installSingleAsset(talUrn);
                            seen.add(talUrn);
                            depCount++;
                        }

                        for (const danceUrn of danceUrns) {
                            if (!seen.has(danceUrn)) {
                                console.log(ui.dim(`\nNode [${nodeId}]: installing dance ${danceUrn}`));
                                await installSingleAsset(danceUrn);
                                seen.add(danceUrn);
                                depCount++;
                            }
                        }
                    }
                    console.log(ui.success(`\n✔ Installed ${depCount} unique dependencies for act '${parts[2]}'.`));
                }
            }
        } else {
            // --- Non-combo/act: single asset install ---
            await installSingleAsset(pkg);
            console.log(ui.success(`\nSuccessfully installed ${pkg}`));
        }
    } catch (error: any) {
        throw new Error(`Install failed: ${error.message}`);
    }
}
