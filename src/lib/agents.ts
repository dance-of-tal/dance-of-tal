import fs from "fs/promises";
import path from "path";
import { getDotDir } from "./registry.js";

/**
 * Mapping of agent role name → local combo name.
 * Stored at .dance-of-tal/agents.json
 *
 * Example:
 * {
 *   "reviewer":    "pr-review",
 *   "implementer": "sprint",
 *   "tester":      "tdd-strict"
 * }
 */
export type AgentManifest = Record<string, string>;

export function getAgentsFilePath(cwd: string = process.cwd()): string {
    return path.join(getDotDir(cwd), "agents.json");
}

/**
 * Read the agents manifest from disk.
 * Returns an empty object if the file does not exist.
 */
export async function readAgentManifest(cwd: string = process.cwd()): Promise<AgentManifest> {
    const filePath = getAgentsFilePath(cwd);
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw) as AgentManifest;
    } catch (err: any) {
        if (err.code === "ENOENT") return {};
        throw err;
    }
}

/**
 * Write an agents manifest to disk.
 */
export async function writeAgentManifest(cwd: string, manifest: AgentManifest): Promise<void> {
    const filePath = getAgentsFilePath(cwd);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(manifest, null, 2), "utf-8");
}
