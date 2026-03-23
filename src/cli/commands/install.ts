import { ui } from "../utils/ui.js";
import { installAsset } from "../../lib/installer.js";
import { installActWithDependencies, installPerformerWithDeps } from "../../lib/dependency-resolver.js";
import { reportInstall } from "../../lib/registry-api.js";
import { isAssetKind } from "../../lib/kinds.js";
import { getGlobalCwd, getGlobalDotDir } from "../../lib/registry.js";

function resolveCwd(global?: boolean): string {
    if (global) return getGlobalCwd();
    return process.cwd();
}

export async function runInstall(pkg: string, options?: { global?: boolean }) {
    const parts = pkg.split("/");
    if (parts.length !== 4 || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid URN format: '${pkg}'\n` +
            `  Expected: <kind>/@<owner>/<stage>/<name>\n` +
            `  Example:  tal/@acme/agent-presets/system-architect`
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
        console.log(ui.dim("Installing performer...\n"));
        const result = await installPerformerWithDeps(cwd, pkg);

        const newCount = result.installedAssets.filter(a => !a.skipped).length;
        const skipCount = result.installedAssets.filter(a => a.skipped).length;

        // Report installs for non-skipped assets
        for (const asset of result.installedAssets) {
            if (!asset.skipped) await reportInstall(asset.urn);
        }

        console.log(ui.success(`\n✔ Installed ${newCount} asset(s), skipped ${skipCount}. [${scopeLabel}]`));
        console.log(
            "\n" +
            ui.success(`✔ Ready! Performer: ${ui.highlight(pkg)}`) +
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

        // Report installs for non-skipped assets
        for (const asset of result.installedAssets) {
            if (!asset.skipped) await reportInstall(asset.urn);
        }
    } else {
        // Single asset (tal, dance)
        const result = await installAsset(cwd, pkg);
        if (result.skipped) {
            console.log(ui.dim(`  Already installed: ${pkg}`));
        } else {
            await reportInstall(pkg);
            console.log(ui.success(`\n✔ Installed ${pkg} [${scopeLabel}]`));
            console.log(ui.dim(`  Saved to: ${result.filePath}`));
        }
    }
}
