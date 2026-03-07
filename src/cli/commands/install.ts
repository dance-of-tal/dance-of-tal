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
export async function runInstall(pkg: string, options?: { global?: boolean }) {
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
        // Performer: cascading install + auto-lock
        console.log(ui.dim("Installing performer...\n"));
        const result = await installPerformerAndLock(cwd, pkg);

        const newCount = result.installedAssets.filter(a => !a.skipped).length;
        const skipCount = result.installedAssets.filter(a => a.skipped).length;

        console.log(ui.success(`\n✔ Installed ${newCount} asset(s), skipped ${skipCount}. [${scopeLabel}]`));
        console.log(ui.success(`✔ Performer locked: .dance-of-tal/performer/${result.localName}.json`));

        console.log(
            "\n" +
            ui.success(`✔ Ready! Performer: ${ui.highlight(result.localName)}`) +
            "\n"
        );
    } else if (kind === "act") {
        // Act: install + cascade node performer deps
        const result = await installAsset(cwd, pkg);
        console.log(result.skipped ? ui.dim(`  Already installed: ${pkg}`) : ui.success(`\n✔ Installed act: ${pkg}`));

        // Each node with type worker/orchestrator has a performer URN
        const filePath = assetFilePath(cwd, pkg);
        const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const nodes = content.nodes as Record<string, any> | undefined;
        if (nodes) {
            const seen = new Set<string>();
            let depCount = 0;

            for (const node of Object.values(nodes)) {
                if (typeof node !== "object" || node === null) continue;
                const performerUrn = node.performer;
                if (typeof performerUrn !== "string" || seen.has(performerUrn)) continue;
                seen.add(performerUrn);

                // Install the performer asset itself
                const pResult = await installAsset(cwd, performerUrn);
                if (!pResult.skipped) depCount++;
                console.log(pResult.skipped ? ui.dim(`  ↳ Already installed: ${performerUrn}`) : ui.success(`  ✔ Installed ${performerUrn}`));

                // Then cascade into the performer's tal/dance dependencies
                try {
                    const pContent = JSON.parse(fs.readFileSync(pResult.filePath, "utf-8"));
                    const talUrn = typeof pContent.tal === "string" ? pContent.tal : null;
                    const danceRaw = pContent.dance;
                    const danceUrns: string[] = Array.isArray(danceRaw)
                        ? danceRaw.filter((d: any): d is string => typeof d === "string")
                        : typeof danceRaw === "string" ? [danceRaw] : [];

                    if (talUrn && !seen.has(talUrn)) {
                        seen.add(talUrn);
                        const r = await installAsset(cwd, talUrn);
                        if (!r.skipped) depCount++;
                        console.log(r.skipped ? ui.dim(`  ↳ Already installed: ${talUrn}`) : ui.success(`  ✔ Installed ${talUrn}`));
                    }
                    for (const d of danceUrns) {
                        if (!seen.has(d)) {
                            seen.add(d);
                            const r = await installAsset(cwd, d);
                            if (!r.skipped) depCount++;
                            console.log(r.skipped ? ui.dim(`  ↳ Already installed: ${d}`) : ui.success(`  ✔ Installed ${d}`));
                        }
                    }
                } catch (e: any) {
                    console.log(ui.warning(`  ⚠ Could not resolve dependencies for ${performerUrn}: ${e.message}`));
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
