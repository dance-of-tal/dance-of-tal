import { buildSystemInstructionHeader, buildThinkingPrompt, buildOutputPrompt, buildActPrompt } from "../../lib/persona.js";
import type { Act, Dance, Tal } from "../../data/types.js";

export const buildPromptFromSelection = ({ tal, dance, act, mode }: { tal: Tal | null; dance: Dance | null; act: Act | null; mode: "thinking" | "output" | "combined" }) => {
    const header = buildSystemInstructionHeader();
    const thinkingPrompt = tal ? buildThinkingPrompt(tal) : null;
    const outputPrompt = dance ? buildOutputPrompt(dance) : null;
    const actPrompt = act ? buildActPrompt(act) : null;

    if (mode === "thinking") {
        if (!thinkingPrompt && !actPrompt) throw new Error("Active combo does not include Tal or Act. Switch combo or use --mode combined/output.");
        return thinkingPrompt ?? actPrompt;
    }

    if (mode === "output") {
        if (!outputPrompt) throw new Error("Active combo does not include Dance. Switch combo or use --mode combined/thinking.");
        return outputPrompt;
    }

    return [header, thinkingPrompt, actPrompt, outputPrompt].filter(Boolean).join("\n\n");
};

export const buildRunPackageFromSelection = ({ tal, dance, act, task }: { tal: Tal | null; dance: Dance | null; act: Act | null; task: string }) => {
    const combined = buildPromptFromSelection({ tal, dance, act, mode: "combined" });
    return ["SYSTEM:", combined, "", "USER:", task].join("\n");
};
