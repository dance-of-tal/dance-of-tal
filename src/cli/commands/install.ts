import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";

const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal-v2.workers.dev";

export async function runInstall(pkg: string) {
    console.log(ui.title(`Installing package: ${pkg}`));

    const parts = pkg.split("/");
    if (parts.length !== 3 || !parts[1].startsWith("@")) {
        throw new Error("Invalid package format. Use <category>/@<username>/<name>, e.g., tal/@monarchjuno/strategy-chief");
    }

    const [category, rawUsername, name] = parts;
    const username = rawUsername.startsWith("@") ? rawUsername : `@${rawUsername}`;

    const validCategories = ["vibe", "tal", "dance", "act", "stage", "combo"];
    if (!validCategories.includes(category)) {
        throw new Error(`Invalid category: ${category}. Allowed: ${validCategories.join(", ")}`);
    }

    try {
        const url = `${REGISTRY_URL}/packages/${category}/${username}/${name}`;
        console.log(ui.dim(`Fetching from ${url}...`));
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 404) {
                throw new Error(`Package ${pkg} not found in registry`);
            }
            throw new Error(`Failed to fetch from registry: ${res.statusText}`);
        }

        const { success, package: pkgData } = await res.json() as any;
        if (!success || !pkgData) {
            throw new Error("Invalid response from registry");
        }

        const dotDir = path.join(process.cwd(), ".dance-of-tal");
        if (!fs.existsSync(dotDir)) {
            throw new Error("Project not initialized. Run 'dot init' first.");
        }

        const targetDir = path.join(dotDir, `${category}s`);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.join(targetDir, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(pkgData.content, null, 2));

        console.log(ui.success(`\nSuccessfully installed ${pkg}`));
        console.log(ui.dim(`Saved to: ${filePath}`));

    } catch (error: any) {
        throw new Error(`Install failed: ${error.message}`);
    }
}
