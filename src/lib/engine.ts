import { Combo } from "./registry.js";
import { Tal, Dance, Act } from "../data/types.js";
import { assetFilePath } from "./registry.js";
import fs from "fs/promises";

export interface CompiledContext {
    systemPrompt: string;
    schema?: Record<string, any>;
}

/** Normalises combo fields, handling optional tal/dance. */
export function normaliseCombo(combo: Combo): { tal: string | null; dances: string[]; act?: string } {
    return {
        tal: combo.tal ?? null,
        dances: combo.dance
            ? (Array.isArray(combo.dance) ? combo.dance : [combo.dance])
            : [],
        act: combo.act,
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
                `Asset not found: ${urn}\n  Expected at: ${filePath}\n  Run 'dot install ${urn}' or use install_combo MCP tool.`
            );
        }
        throw err;
    }
}

/**
 * Validates that all URNs in a Combo follow the strict 3-part format.
 * At least one of tal or dance must be present.
 */
export function validateCombo(combo: Combo): void {
    const { tal, dances } = normaliseCombo(combo);

    if (!tal && dances.length === 0) {
        throw new Error("Invalid combo: at least one of 'tal' or 'dance' must be present.");
    }

    const validateUrn = (urn: string, prefix: string) => {
        const parts = urn.split("/");
        if (parts.length !== 3 || parts[0] !== prefix || !parts[1].startsWith("@") || !parts[2]) {
            throw new Error(`Invalid URN: '${urn}'. Expected: ${prefix}/@<author>/<name>`);
        }
    };

    if (tal) validateUrn(tal, "tal");
    for (const d of dances) validateUrn(d, "dance");
    if (combo.act) validateUrn(combo.act, "act");
}

/**
 * Validates that all combo assets exist on disk.
 */
export async function validateComboFiles(cwd: string, combo: Combo): Promise<void> {
    validateCombo(combo);
    const { tal, dances } = normaliseCombo(combo);
    if (tal) await loadAsset(cwd, tal);
    for (const d of dances) await loadAsset(cwd, d);
    if (combo.act) await loadAsset(cwd, combo.act);
}

/**
 * Determines the combo mode based on its composition.
 */
export function determineComboMode(combo: Combo): "tal-only" | "dance-only" | "combo" | "act" {
    if (combo.act) return "act";
    const { tal, dances } = normaliseCombo(combo);
    if (tal && dances.length === 0) return "tal-only";
    if (!tal && dances.length > 0) return "dance-only";
    return "combo";
}

/**
 * Compiles a Combo into an executable prompt payload.
 *
 * - tal present  → [BEHAVIOR MODE] block included
 * - dance present → [OUTPUT FORMATTING] block with merged rules/schema
 * - act present  → [WORKFLOW ACT] block included
 * - At least one of tal or dance must be present.
 */
export async function compileContext(
    combo: Combo,
    taskContext: string,
    cwd: string = process.cwd()
): Promise<CompiledContext> {
    validateCombo(combo);
    const { tal: talUrn, dances } = normaliseCombo(combo);

    // Load tal (optional)
    const tal: Tal | null = talUrn ? await loadAsset(cwd, talUrn) : null;

    // Load dances (optional, may be empty)
    const danceAssets: Dance[] = await Promise.all(dances.map((d) => loadAsset(cwd, d)));

    // Load act (optional)
    const actAsset: Act | null = combo.act ? await loadAsset(cwd, combo.act) : null;

    // Build system prompt blocks
    const blocks: string[] = [];

    // Tal block (optional)
    if (tal) {
        blocks.push(`[BEHAVIOR MODE: ${tal.type}]\n${tal.thinking || tal.description}`);
    }

    // Dance block (optional)
    if (danceAssets.length > 0) {
        const mergedRules = danceAssets
            .map((d) => `[${d.type}]\n${d.rules || d.description}`)
            .join("\n\n");
        blocks.push(`[OUTPUT FORMATTING]\n${mergedRules}`);
    }

    // Merged schema from dances
    const mergedSchema = danceAssets.reduce<Record<string, any> | undefined>((acc, d) => {
        if (!d.schema) return acc;
        return acc ? deepMerge(acc, d.schema as Record<string, any>) : { ...(d.schema as Record<string, any>) };
    }, undefined);

    // Act block (optional)
    if (actAsset) {
        const actLines: string[] = [];
        if (actAsset.description) actLines.push(actAsset.description);
        if (Array.isArray(actAsset.steps) && actAsset.steps.length > 0) {
            actLines.push(`Steps: ${actAsset.steps.join(" -> ")}`);
        }
        if (actAsset.nodes && Object.keys(actAsset.nodes).length > 0) {
            actLines.push(`Nodes: ${Object.keys(actAsset.nodes).join(", ")}`);
        }
        if (actLines.length > 0) {
            blocks.push(`[WORKFLOW ACT: ${actAsset.type || combo.act}]\n${actLines.join("\n")}`);
        }
    }

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
