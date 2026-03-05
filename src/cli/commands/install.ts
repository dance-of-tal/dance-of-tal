import { ui } from "../utils/ui.js";
import { installAsset, installComboAndLock } from "../../lib/installer.js";
import { isAssetKind } from "../../lib/kinds.js";
import { assetFilePath, getDotDir } from "../../lib/registry.js";
import fs from "fs";

/**
 * CLI adapter for install.
 * Delegates to shared core (lib/installer), adds console.log UX.
 */
export async function runInstall(pkg: string, options?: { lock?: boolean }) {
    const parts = pkg.split("/");
    if (parts.length !== 3 || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid URN format: '${pkg}'\n` +
            `  Expected: <kind>/@<author>/<name>\n` +
            `  Example:  tal/@acme/system-architect`
        );
    }

    const [kind] = parts;
    if (!isAssetKind(kind)) {
        throw new Error(`Invalid kind: '${kind}'. Allowed: tal, dance, act, combo`);
    }


    const cwd = process.cwd();

    console.log(ui.title(`Installing package: ${pkg}`));

    if (kind === "combo") {
        // Combo: cascading install + auto-lock (unless --no-lock)
        const shouldLock = options?.lock !== false;

        if (shouldLock) {
            console.log(ui.dim("Installing combo with auto-lock...\n"));
            const result = await installComboAndLock(cwd, pkg);

            const newCount = result.installedAssets.filter(a => !a.skipped).length;
            const skipCount = result.installedAssets.filter(a => a.skipped).length;

            console.log(ui.success(`\n✔ Installed ${newCount} asset(s), skipped ${skipCount}.`));
            console.log(ui.success(`✔ Lockfile created: .dance-of-tal/combo/${result.localName}.json`));

            console.log(
                "\n" +
                ui.success(`✔ Ready! Combo locked as: ${ui.highlight(result.localName)}`) +
                "\n"
            );
            console.log(ui.dim(`  MCP: init_run → get_run_context (uses combo '${result.localName}')`));
        } else {
            // --no-lock: install only, no lockfile
            console.log(ui.dim("Installing combo (no lock)...\n"));
            const result = await installAsset(cwd, pkg);
            if (result.skipped) {
                console.log(ui.dim(`  ↳ Already installed, skipping: ${pkg}`));
            } else {
                console.log(ui.success(`  ✔ Installed ${pkg}`));
            }

            // Cascading deps without lock
            const filePath = assetFilePath(cwd, pkg);
            const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            const talUrn = typeof content.tal === "string" ? content.tal : null;
            const danceRaw = content.dance;
            const danceUrns: string[] = Array.isArray(danceRaw)
                ? danceRaw.filter((d: any): d is string => typeof d === "string")
                : typeof danceRaw === "string" ? [danceRaw] : [];
            const actUrn = typeof content.act === "string" ? content.act : null;

            if (talUrn) {
                const r = await installAsset(cwd, talUrn);
                console.log(r.skipped ? ui.dim(`  ↳ Already installed: ${talUrn}`) : ui.success(`  ✔ Installed ${talUrn}`));
            }
            for (const d of danceUrns) {
                const r = await installAsset(cwd, d);
                console.log(r.skipped ? ui.dim(`  ↳ Already installed: ${d}`) : ui.success(`  ✔ Installed ${d}`));
            }
            if (actUrn) {
                const r = await installAsset(cwd, actUrn);
                console.log(r.skipped ? ui.dim(`  ↳ Already installed: ${actUrn}`) : ui.success(`  ✔ Installed ${actUrn}`));
            }

            console.log(ui.success(`\n✔ All dependencies installed. Use 'dot lock' to create a lockfile.`));
        }
    } else if (kind === "act") {
        // Act: install + cascade (node deps)
        const result = await installAsset(cwd, pkg);
        console.log(result.skipped ? ui.dim(`  Already installed: ${pkg}`) : ui.success(`\n✔ Installed act: ${pkg}`));

        // Browse nodes for deps
        const filePath = assetFilePath(cwd, pkg);
        const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const nodes = content.nodes as Record<string, any> | undefined;
        if (nodes) {
            const seen = new Set<string>();
            let depCount = 0;
            for (const [nodeId, nodeValue] of Object.entries(nodes)) {
                const talUrn = typeof nodeValue.tal === "string" ? nodeValue.tal : null;
                const ds: string[] = Array.isArray(nodeValue.dance)
                    ? nodeValue.dance.filter((d: any): d is string => typeof d === "string")
                    : typeof nodeValue.dance === "string" ? [nodeValue.dance] : [];
                if (talUrn && !seen.has(talUrn)) {
                    const r = await installAsset(cwd, talUrn);
                    if (!r.skipped) depCount++;
                    seen.add(talUrn);
                }
                for (const d of ds) {
                    if (!seen.has(d)) {
                        const r = await installAsset(cwd, d);
                        if (!r.skipped) depCount++;
                        seen.add(d);
                    }
                }
            }
            console.log(ui.success(`\n✔ Installed ${depCount} unique dependencies for act.`));
        }
    } else {
        // Single asset (tal, dance)
        const result = await installAsset(cwd, pkg);
        if (result.skipped) {
            console.log(ui.dim(`  Already installed: ${pkg}`));
        } else {
            console.log(ui.success(`\n✔ Installed ${pkg}`));
            console.log(ui.dim(`  Saved to: ${result.filePath}`));
        }
    }
}
