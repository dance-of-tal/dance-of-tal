import { ui } from "../utils/ui.js";
import { installAsset, installPerformerAndLock } from "../../lib/installer.js";
import { isAssetKind } from "../../lib/kinds.js";
import { assetFilePath, getGlobalCwd, getGlobalDotDir } from "../../lib/registry.js";
import fs from "fs";

/**
 * Resolves the target cwd based on --global flag.
 *   -g / --global → DANCE_OF_TAL_HOME or os.homedir()
 *   default       → process.cwd() (project-local)
 */
function resolveCwd(global?: boolean): string {
    if (global) return getGlobalCwd();
    return process.cwd();
}

/**
 * CLI adapter for install.
 * Delegates to shared core (lib/installer), adds console.log UX.
 */
export async function runInstall(pkg: string, options?: { lock?: boolean; global?: boolean }) {
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
        throw new Error(`Invalid kind: '${kind}'. Allowed: tal, dance, act, performer`);
    }

    const cwd = resolveCwd(options?.global);
    const scopeLabel = options?.global ? "global" : "local";

    console.log(ui.title(`Installing package: ${pkg}`));
    if (options?.global) {
        console.log(ui.dim(`  Scope: global (${getGlobalDotDir()})`));
    }

    if (kind === "performer") {
        // Performer: cascading install + auto-lock (unless --no-lock)
        const shouldLock = options?.lock !== false;

        if (shouldLock) {
            console.log(ui.dim("Installing performer with auto-lock...\n"));
            const result = await installPerformerAndLock(cwd, pkg);

            const newCount = result.installedAssets.filter(a => !a.skipped).length;
            const skipCount = result.installedAssets.filter(a => a.skipped).length;

            console.log(ui.success(`\n✔ Installed ${newCount} asset(s), skipped ${skipCount}. [${scopeLabel}]`));
            console.log(ui.success(`✔ Lockfile created: .dance-of-tal/performer/${result.localName}.json`));

            console.log(
                "\n" +
                ui.success(`✔ Ready! Performer locked as: ${ui.highlight(result.localName)}`) +
                "\n"
            );
            console.log(ui.dim("  MCP: setup_workspace → install_asset/list_assets (tal/dance-focused flow)"));
        } else {
            // --no-lock: install only, no lockfile
            console.log(ui.dim("Installing performer (no lock)...\n"));
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

            if (talUrn) {
                const r = await installAsset(cwd, talUrn);
                console.log(r.skipped ? ui.dim(`  ↳ Already installed: ${talUrn}`) : ui.success(`  ✔ Installed ${talUrn}`));
            }
            for (const d of danceUrns) {
                const r = await installAsset(cwd, d);
                console.log(r.skipped ? ui.dim(`  ↳ Already installed: ${d}`) : ui.success(`  ✔ Installed ${d}`));
            }
            if (content.model) {
                console.log(ui.dim(`  ↳ Model identified: ${content.model} (no file installation required)`));
            }

            console.log(ui.success(`\n✔ All dependencies installed. [${scopeLabel}]`));
        }
    } else if (kind === "act") {
        // Act: install + cascade (node deps)
        const result = await installAsset(cwd, pkg);
        console.log(result.skipped ? ui.dim(`  Already installed: ${pkg}`) : ui.success(`\n✔ Installed act: ${pkg}`));

        // Browse performers for deps
        const filePath = assetFilePath(cwd, pkg);
        const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const performers = content.performers as Record<string, any> | undefined;
        if (performers) {
            const seen = new Set<string>();
            let depCount = 0;
            for (const [nodeId, nodeValue] of Object.entries(performers)) {
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
            console.log(ui.success(`\n✔ Installed ${depCount} unique dependencies for act. [${scopeLabel}]`));
        }
    } else {
        // Single asset (tal, dance)
        const result = await installAsset(cwd, pkg);
        if (result.skipped) {
            console.log(ui.dim(`  Already installed: ${pkg}`));
        } else {
            console.log(ui.success(`\n✔ Installed ${pkg} [${scopeLabel}]`));
            console.log(ui.dim(`  Saved to: ${result.filePath}`));
        }
    }
}
