import fs from "fs/promises";
import path from "path";
import { getDotDir, getCombo, Combo } from "./registry.js";
import { compileContext, CompiledContext } from "./engine.js";

// V2 Run State Isolation

export interface RunState {
    runId: string;
    comboName: string;
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
    const dotDir = getDotDir(cwd);
    return path.join(dotDir, "runs", runId);
}

/**
 * Initializes a new run state for an agent
 */
export async function initRun(cwd: string, runId: string, comboName: string): Promise<RunState> {
    const runDir = getRunDir(cwd, runId);
    await fs.mkdir(runDir, { recursive: true });

    const state: RunState = {
        runId,
        comboName,
        status: "initialized",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        logs: [`Run initialized for combo: ${comboName}`]
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

    const combo = await getCombo(cwd, state.comboName);
    if (!combo) {
        throw new Error(`Combo '${state.comboName}' not found in registry.`);
    }

    const compiled = await compileContext(combo, taskContext);

    state.status = "running";
    state.context = compiled;
    state.logs.push(`Context compiled successfully at ${new Date().toISOString()}`);

    await saveRunState(cwd, state);
    return compiled;
}
