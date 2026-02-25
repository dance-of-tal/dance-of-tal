import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";
import { getDotDir, assetFilePath } from "../../lib/registry.js";

const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal-v2.workers.dev";

export async function runInstall(pkg: string) {
    console.log(ui.title(`Installing package: ${pkg}`));

    // Validate URN format: category/@author/name
    const parts = pkg.split("/");
    if (parts.length !== 3 || !parts[1].startsWith("@")) {
        throw new Error(
            `Invalid URN format: '${pkg}'\n` +
            `  Expected: <category>/@<author>/<name>\n` +
            `  Example:  tal/@monarchjuno/system-architect`
        );
    }

    const [category] = parts;
    const validCategories = ["tal", "dance", "act", "combo"];
    if (!validCategories.includes(category)) {
        throw new Error(`Invalid category: '${category}'. Allowed: ${validCategories.join(", ")}`);
    }

    // Fetch from remote registry
    const url = `${REGISTRY_URL}/packages/${parts[0]}/${parts[1]}/${parts[2]}`;
    console.log(ui.dim(`Fetching from ${url}...`));

    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 404) throw new Error(`Package '${pkg}' not found in registry.`);
            throw new Error(`Registry error: ${res.statusText}`);
        }

        const { success, package: pkgData } = (await res.json()) as any;
        if (!success || !pkgData) throw new Error("Invalid response from registry.");

        // Ensure workspace is initialised
        const dotDir = getDotDir(process.cwd());
        if (!fs.existsSync(dotDir)) {
            throw new Error("Workspace not initialised. Run 'dot init' first.");
        }

        // Derive file path from URN: .dance-of-tal/<category>/@<author>/<name>.json
        const filePath = assetFilePath(process.cwd(), pkg);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(pkgData.content, null, 2));

        console.log(ui.success(`\nSuccessfully installed ${pkg}`));
        console.log(ui.dim(`Saved to: ${filePath}`));
    } catch (error: any) {
        throw new Error(`Install failed: ${error.message}`);
    }
}
