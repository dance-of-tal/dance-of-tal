import { Combo } from "./registry.js";
import { Tal, Dance } from "../data/types.js";

// Mocking the catalog imports for now to represent V2 type retrieval
// In a real implementation this would fetch from `.dance-of-tal/registry/` or a predefined global catalog

export interface CompiledContext {
    systemPrompt: string;
    schema?: Record<string, any>;
}

/**
 * Validates a combo to ensure the URN types are correct and compatible
 */
export function validateCombo(combo: Combo): void {
    if (!combo.tal.startsWith("tal/")) {
        throw new Error(`Invalid Tal URN: ${combo.tal}. Must start with 'tal/'`);
    }
    if (!combo.dance.startsWith("dance/")) {
        throw new Error(`Invalid Dance URN: ${combo.dance}. Must start with 'dance/'`);
    }
    if (combo.act && !combo.act.startsWith("act/")) {
        throw new Error(`Invalid Act URN: ${combo.act}. Must start with 'act/'`);
    }
}

/**
 * Compiles a Tal logic structure and a Dance presentation format into a unified executable Prompt Payload.
 * Represents the heart of the "Context Provider Mode".
 */
export async function compileContext(combo: Combo, taskContext: string): Promise<CompiledContext> {
    // Validate type safety first
    validateCombo(combo);

    // Example mocked extraction (In production, read from registry):
    const mockTal: Tal = {
        type: combo.tal,
        slug: combo.tal.replace("tal/", ""),
        name: "Mock Tal Profile",
        description: "Sample Tal loaded dynamically",
        category: "system",
        tags: [],
        featuredScore: 0,
        createdAt: new Date().toISOString(),
        thinking: "Analyze systematically according to strict logic trees."
    };

    const mockDance: Dance = {
        type: combo.dance,
        slug: combo.dance.replace("dance/", ""),
        name: "Mock Dance Profile",
        description: "Sample Dance styling",
        category: "json",
        rules: "Output strictly according to the provided JSON Schema.",
        schema: {
            type: "object",
            properties: {
                output: { type: "string" }
            },
            required: ["output"]
        }
    };

    const systemPrompt = `[BEHAVIOR MODE: ${mockTal.type}]\n${mockTal.thinking}\n\n[OUTPUT FORMATTING: ${mockDance.type}]\n${mockDance.rules}\n\n[CURRENT TASK]\n${taskContext}`;

    return {
        systemPrompt,
        schema: mockDance.schema
    };
}
