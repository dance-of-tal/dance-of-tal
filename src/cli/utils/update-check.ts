import fs from "fs";
import path from "path";
import os from "os";
import { ui } from "./ui.js";

const PACKAGE_NAME = "dance-of-tal";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

interface UpdateCache {
    lastCheck: number;
    latestVersion: string | null;
}

function getCachePath(): string {
    return path.join(os.homedir(), ".dance-of-tal", "update-check.json");
}

function readCache(): UpdateCache | null {
    try {
        return JSON.parse(fs.readFileSync(getCachePath(), "utf-8"));
    } catch {
        return null;
    }
}

function writeCache(cache: UpdateCache): void {
    const dir = path.dirname(getCachePath());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getCachePath(), JSON.stringify(cache), "utf-8");
}

function getCurrentVersion(): string {
    try {
        const pkgPath = new URL("../../../package.json", import.meta.url);
        return JSON.parse(fs.readFileSync(pkgPath, "utf-8")).version;
    } catch {
        return "0.0.0";
    }
}

async function fetchLatestVersion(): Promise<string | null> {
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) return null;
        return ((await res.json()) as any).version ?? null;
    } catch {
        return null;
    }
}

function isNewer(current: string, latest: string): boolean {
    const p = (v: string) => v.split(".").map(Number);
    const [cM, cm, cp] = p(current);
    const [lM, lm, lp] = p(latest);
    return lM > cM || (lM === cM && lm > cm) || (lM === cM && lm === cm && lp > cp);
}

function printNotice(current: string, latest: string): void {
    const line = "─".repeat(48);
    console.log("");
    console.log(ui.warning(line));
    console.log(ui.warning(`  Update available: ${current} → ${latest}`));
    console.log(ui.dim(`  Run: npm install -g dance-of-tal@latest`));
    console.log(ui.warning(line));
    console.log("");
}

/**
 * Non-blocking update check. Cached 24h. Network failures silently ignored.
 */
export async function checkForUpdates(): Promise<void> {
    try {
        const cache = readCache();
        const now = Date.now();

        if (cache && (now - cache.lastCheck) < CHECK_INTERVAL_MS) {
            if (cache.latestVersion) {
                const cur = getCurrentVersion();
                if (isNewer(cur, cache.latestVersion)) printNotice(cur, cache.latestVersion);
            }
            return;
        }

        const latest = await fetchLatestVersion();
        writeCache({ lastCheck: now, latestVersion: latest });

        if (latest) {
            const cur = getCurrentVersion();
            if (isNewer(cur, latest)) printNotice(cur, latest);
        }
    } catch {
        // Never crash CLI for update checks
    }
}
