import { Combo } from "./registry.js";
import { Tal, Dance } from "../data/types.js";
import { assetFilePath } from "./registry.js";
import fs from "fs/promises";

export interface CompiledContext {
    systemPrompt: string;
    schema?: Record<string, any>;
}

/** Normalises dance field to always be an array. */
export function normaliseCombo(combo: Combo): { tal: string; dances: string[]; act?: string } {
    return {
        tal: combo.tal,
        dances: Array.isArray(combo.dance) ? combo.dance : [combo.dance],
        act: combo.act,
    };
}

/**
 * Loads a locally installed asset by URN.
 * Path: .dance-of-tal/<category>/@<author>/<name>.json
 */
async function loadAsset(cwd: string, urn: string): Promise<any> {
    const filePath = assetFilePath(cwd, urn);
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    } catch (err: any) {
        if (err.code === "ENOENT") {
            throw new Error(
                `Asset not found: ${urn}\n  Expected at: ${filePath}\n  Run 'dot install ${urn}' first.`
            );
        }
        throw err;
    }
}

/**
 * Validates that all URNs in a Combo follow the strict 3-part format.
 */
export function validateCombo(combo: Combo): void {
    const validateUrn = (urn: string, prefix: string) => {
        const parts = urn.split("/");
        if (parts.length !== 3 || parts[0] !== prefix || !parts[1].startsWith("@") || !parts[2]) {
            throw new Error(`Invalid URN: '${urn}'. Expected: ${prefix}/@<author>/<name>`);
        }
    };

    const { tal, dances } = normaliseCombo(combo);
    validateUrn(tal, "tal");
    for (const d of dances) validateUrn(d, "dance");
    if (combo.act) validateUrn(combo.act, "act");
}

/**
 * Validates that all combo assets exist on disk.
 */
export async function validateComboFiles(cwd: string, combo: Combo): Promise<void> {
    validateCombo(combo);
    const { tal, dances } = normaliseCombo(combo);
    await loadAsset(cwd, tal);
    for (const d of dances) await loadAsset(cwd, d);
    if (combo.act) await loadAsset(cwd, combo.act);
}

/**
 * Compiles a Tal + one-or-more Dances into an executable prompt payload.
 *
 * Dance layering:
 *  - rules   → concatenated in order (first = base, last = most specific)
 *  - schema  → deep-merged in order (later keys override earlier ones)
 */
export async function compileContext(combo: Combo, taskContext: string): Promise<CompiledContext> {
    validateCombo(combo);
    const { tal: talUrn, dances } = normaliseCombo(combo);
    const cwd = process.cwd();

    const tal: Tal = await loadAsset(cwd, talUrn);
    const danceAssets: Dance[] = await Promise.all(dances.map((d) => loadAsset(cwd, d)));

    // Merge Dance layers
    const mergedRules = danceAssets
        .map((d) => `[${d.type}]\n${d.rules || d.description}`)
        .join("\n\n");

    const mergedSchema = danceAssets.reduce<Record<string, any> | undefined>((acc, d) => {
        if (!d.schema) return acc;
        return acc ? deepMerge(acc, d.schema as Record<string, any>) : { ...(d.schema as Record<string, any>) };
    }, undefined);

    const systemPrompt =
        `[BEHAVIOR MODE: ${tal.type}]\n${tal.thinking || tal.description}\n\n` +
        `[OUTPUT FORMATTING]\n${mergedRules}\n\n` +
        `[CURRENT TASK]\n${taskContext}`;

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
