import { Performer } from "../data/types.js";
import { assetFilePath } from "./registry.js";
import fs from "fs/promises";

export interface CompiledContext {
    systemPrompt: string;
    schema?: Record<string, any>;
}

/** Normalises performer fields, handling optional tal/dance/act. */
export function normalisePerformer(performer: Performer): { tal: string | null; dances: string[]; act: string | null } {
    return {
        tal: performer.tal ?? null,
        dances: performer.dance
            ? (Array.isArray(performer.dance) ? performer.dance : [performer.dance])
            : [],
        act: performer.act ?? null,
    };
}

/**
 * Loads a locally installed asset by URN.
 * Path: .dance-of-tal/<kind>/@<author>/<name>.json
 */
async function loadAsset(cwd: string, urn: string): Promise<any> {
    const filePath = assetFilePath(cwd, urn);
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    } catch (err: any) {
        if (err.code === "ENOENT") {
            throw new Error(
                `Asset not found: ${urn}\n  Expected at: ${filePath}\n  Run 'dot install ${urn}' or use install_asset MCP tool.`
            );
        }
        throw err;
    }
}

/**
 * Validates that all URNs in a Performer follow the strict 3-part format.
 * At least one of tal or dance must be present.
 */
export function validatePerformer(performer: Performer): void {
    const { tal, dances, act } = normalisePerformer(performer);

    if (!tal && dances.length === 0) {
        throw new Error("Invalid performer: at least one of 'tal' or 'dance' must be present.");
    }

    const validateUrn = (urn: string, prefix: string) => {
        const parts = urn.split("/");
        if (parts.length !== 3 || parts[0] !== prefix || !parts[1].startsWith("@") || !parts[2]) {
            throw new Error(`Invalid URN: '${urn}'. Expected: ${prefix}/@<author>/<name>`);
        }
    };

    if (tal) validateUrn(tal, "tal");
    for (const d of dances) validateUrn(d, "dance");
    if (act) validateUrn(act, "act");
}

/**
 * Validates that all performer assets exist on disk.
 */
export async function validatePerformerFiles(cwd: string, performer: Performer): Promise<void> {
    validatePerformer(performer);
    const { tal, dances, act } = normalisePerformer(performer);
    if (tal) await loadAsset(cwd, tal);
    for (const d of dances) await loadAsset(cwd, d);
    if (act) await loadAsset(cwd, act);
}

/**
 * Determines the performer mode based on its composition.
 */
export function determinePerformerMode(performer: Performer): "tal-only" | "dance-only" | "performer" {
    const { tal, dances } = normalisePerformer(performer);
    if (tal && dances.length === 0) return "tal-only";
    if (!tal && dances.length > 0) return "dance-only";
    return "performer";
}

/**
 * Compiles a Performer into an executable prompt payload.
 *
 * - tal present  → [BEHAVIOR MODE] block included
 * - dance present → [OUTPUT FORMATTING] block with merged content/schema
 * - act present -> [WORKFLOW ACT] block appended
 * - At least one of tal or dance must be present.
 */
export async function compileContext(
    performer: Performer,
    taskContext: string,
    cwd: string = process.cwd()
): Promise<CompiledContext> {
    validatePerformer(performer);
    const { tal: talUrn, dances, act: actUrn } = normalisePerformer(performer);

    // Load tal (optional)
    const tal: any = talUrn ? await loadAsset(cwd, talUrn) : null;

    // Load dances (optional, may be empty)
    const danceAssets: any[] = await Promise.all(dances.map((d) => loadAsset(cwd, d)));

    // Load act (optional)
    const act: any = actUrn ? await loadAsset(cwd, actUrn) : null;

    // Build system prompt blocks
    const blocks: string[] = [];

    // Act block (optional) - V3 prepends workflow context
    if (act) {
        let actBlock = `[WORKFLOW ACT: ${act.type}]\n${act.content || act.description || ""}`;
        if (act.steps && Array.isArray(act.steps)) {
            actBlock += `\nSteps: ${act.steps.join(" -> ")}`;
        }
        blocks.push(actBlock);
    }

    // Tal block (optional)
    if (tal) {
        blocks.push(`[BEHAVIOR MODE: ${tal.type}]\n${tal.content || tal.description}`);
    }

    // Dance block (optional)
    if (danceAssets.length > 0) {
        const mergedRules = danceAssets
            .map((d) => `[${d.type}]\n${d.content || d.description}`)
            .join("\n\n");
        blocks.push(`[OUTPUT FORMATTING]\n${mergedRules}`);
    }

    // Merged schema from dances
    const mergedSchema = danceAssets.reduce<Record<string, any> | undefined>((acc, d) => {
        if (!d.schema) return acc;
        return acc ? deepMerge(acc, d.schema as Record<string, any>) : { ...(d.schema as Record<string, any>) };
    }, undefined);

    // Task context (always present)
    blocks.push(`[CURRENT TASK]\n${taskContext}`);

    const systemPrompt = blocks.join("\n\n");
    return { systemPrompt, schema: mergedSchema };
}

/** Recursively merges b into a. Later (b) values override earlier (a) values. */
function deepMerge(a: Record<string, any>, b: Record<string, any>): Record<string, any> {
    const result = { ...a };
    for (const [k, v] of Object.entries(b)) {
        if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object") {
            result[k] = deepMerge(a[k], v);
        } else {
            result[k] = v;
        }
    }
    return result;
}
