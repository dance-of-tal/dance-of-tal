import { ui } from "../utils/ui.js";
import { installActWithDependencies, installAsset, installPerformerAndLock } from "../../lib/installer.js";
import { isAssetKind } from "../../lib/kinds.js";
import { getGlobalDotDir } from "../../lib/registry.js";

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
        const result = await installActWithDependencies(cwd, pkg);
        console.log(result.actAsset.skipped ? ui.dim(`  Already installed: ${pkg}`) : ui.success(`\n✔ Installed act: ${pkg}`));

        const dependencyAssets = result.installedAssets.filter((asset) => asset.urn !== result.actUrn);
        for (const asset of dependencyAssets) {
            console.log(
                asset.skipped
                    ? ui.dim(`  ↳ Already installed: ${asset.urn}`)
                    : ui.success(`  ✔ Installed ${asset.urn}`)
            );
        }
        console.log(ui.success(`\n✔ Installed ${dependencyAssets.filter((asset) => !asset.skipped).length} unique dependencies for act. [${scopeLabel}]`));
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
