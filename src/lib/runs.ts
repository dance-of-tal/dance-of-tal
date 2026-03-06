import fs from "fs/promises";
import path from "path";
import { getDotDir, getPerformer } from "./registry.js";
import { compileContext, CompiledContext, determinePerformerMode } from "./engine.js";
import { readAgentManifest } from "./agents.js";
import { assertPathInside, assertSafeRunId } from "./identifiers.js";

// V3 Run State — explicit performer resolution

export interface RunState {
    runId: string;
    resolvedPerformerName: string;    // The performer actually bound to this run
    agentName?: string;           // If resolved via agents.json
    mode: "tal-only" | "dance-only" | "performer";
    status: "initialized" | "running" | "completed" | "failed";
    createdAt: string;
    updatedAt: string;
    context?: CompiledContext;
    logs: string[];
}

/**
 * Gets the isolated directory path for a specific agent run
 */
export function getRunDir(cwd: string, runId: string): string {
    assertSafeRunId(runId);
    const runsDir = path.resolve(getDotDir(cwd), "runs");
    const runDir = path.resolve(runsDir, runId);
    assertPathInside(runsDir, runDir, "run");
    return runDir;
}

/**
 * Resolves the performer name from either performerName or agentName.
 * Priority: performerName > agentName (via agents.json lookup).
 */
export async function resolvePerformerName(
    cwd: string,
    performerName?: string,
    agentName?: string
): Promise<{ resolvedPerformerName: string; agentName?: string }> {
    if (performerName) {
        return { resolvedPerformerName: performerName };
    }

    if (agentName) {
        const manifest = await readAgentManifest(cwd);
        const mapped = manifest[agentName];
        if (!mapped) {
            const available = Object.keys(manifest);
            throw new Error(
                `Agent '${agentName}' not found in agents.json.` +
                (available.length > 0
                    ? `\n  Available agents: ${available.join(", ")}`
                    : `\n  No agents defined. Use 'dot agents set --agent <name> --performer <performerName>' to add one.`)
            );
        }
        return { resolvedPerformerName: mapped, agentName };
    }

    throw new Error(
        "Either 'performerName' or 'agentName' must be provided.\n" +
        "  performerName: direct performer name (e.g. 'sprint')\n" +
        "  agentName: agent name mapped in agents.json (e.g. 'reviewer')"
    );
}

/**
 * Initializes a new run state for an agent
 */
export async function initRun(
    cwd: string,
    runId: string,
    performerName?: string,
    agentName?: string
): Promise<RunState> {
    const { resolvedPerformerName, agentName: resolvedAgent } =
        await resolvePerformerName(cwd, performerName, agentName);

    const performer = await getPerformer(cwd, resolvedPerformerName);
    if (!performer) {
        throw new Error(
            `Performer '${resolvedPerformerName}' not found locally. Ensure the lockfile exists under .dance-of-tal/performer/.`
        );
    }

    const mode = determinePerformerMode(performer);

    const runDir = getRunDir(cwd, runId);
    await fs.mkdir(runDir, { recursive: true });

    const state: RunState = {
        runId,
        resolvedPerformerName,
        ...(resolvedAgent ? { agentName: resolvedAgent } : {}),
        mode,
        status: "initialized",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        logs: [`Run initialized: performer=${resolvedPerformerName}, mode=${mode}${resolvedAgent ? `, agent=${resolvedAgent}` : ""}`],
    };

    await saveRunState(cwd, state);
    return state;
}

/**
 * Saves the current state of a run
 */
export async function saveRunState(cwd: string, state: RunState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    const statePath = path.join(getRunDir(cwd, state.runId), "state.json");
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Retrieves an existing run state
 */
export async function getRunState(cwd: string, runId: string): Promise<RunState | null> {
    const statePath = path.join(getRunDir(cwd, runId), "state.json");
    try {
        const raw = await fs.readFile(statePath, "utf-8");
        return JSON.parse(raw) as RunState;
    } catch (err: any) {
        if (err.code === "ENOENT") return null;
        throw err;
    }
}

/**
 * Deletes a run state and its isolated directory
 */
export async function clearRun(cwd: string, runId: string): Promise<void> {
    const runDir = getRunDir(cwd, runId);
    try {
        await fs.rm(runDir, { recursive: true, force: true });
    } catch (err) {
        // Ignore if it doesn't exist
    }
}

/**
 * Compiles and attaches the context to an active run
 */
export async function startRunContext(cwd: string, runId: string, taskContext: string): Promise<CompiledContext> {
    const state = await getRunState(cwd, runId);
    if (!state) {
        throw new Error(`Run ${runId} not found. Please initialize it first.`);
    }

    const performer = await getPerformer(cwd, state.resolvedPerformerName);
    if (!performer) {
        throw new Error(`Performer '${state.resolvedPerformerName}' not found in registry.`);
    }

    const compiled = await compileContext(performer, taskContext, cwd);

    state.status = "running";
    state.context = compiled;
    state.logs.push(`Context compiled successfully at ${new Date().toISOString()}`);

    await saveRunState(cwd, state);
    return compiled;
}
