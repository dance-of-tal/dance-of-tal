import { findDance, findTal } from "../../lib/persona.js";
import { readProjectConfig } from "../dot-config.js";
import type { Dance, Tal } from "../../data/types.js";
import type { DotDanceRef, DotTalRef } from "../dot-config.js";

export const readProjectArg = (args: string[]) => {
    const flagIndex = args.indexOf("--project");
    if (flagIndex !== -1 && args[flagIndex + 1]) {
        return args[flagIndex + 1];
    }
    return process.cwd();
};

export const resolveTal = (
    config: NonNullable<Awaited<ReturnType<typeof readProjectConfig>>>,
    talRef: { kind: "preset"; slug: string } | { kind: "custom"; id: string } | null
) => {
    if (!talRef) return null;
    if (talRef.kind === "preset") {
        return findTal(talRef.slug) ?? null;
    }
    return config.customTals.find((item) => item.id === talRef.id)?.tal ?? null;
};

export const resolveDance = (
    config: NonNullable<Awaited<ReturnType<typeof readProjectConfig>>>,
    danceRef: { kind: "preset"; slug: string } | { kind: "custom"; id: string } | null
) => {
    if (!danceRef) return null;
    if (danceRef.kind === "preset") {
        return findDance(danceRef.slug) ?? null;
    }
    return config.customDances.find((item) => item.id === danceRef.id)?.dance ?? null;
};

export async function getResolvedActiveCombo(projectDir: string) {
    const config = await readProjectConfig(projectDir);
    if (!config || !config.activeComboId) return null;

    const combo = config.combos.find((item) => item.id === config.activeComboId);
    if (!combo) return null;

    const tal = resolveTal(config, combo.talRef);
    const dance = resolveDance(config, combo.danceRef);

    if (combo.talRef && !tal) {
        throw new Error(`Active combo has missing Tal reference: ${combo.id}`);
    }
    if (combo.danceRef && !dance) {
        throw new Error(`Active combo has missing Dance reference: ${combo.id}`);
    }
    if (!tal && !dance) {
        throw new Error(`Active combo has no Tal/Dance: ${combo.id}`);
    }

    return { config, combo, tal, dance };
}

export const describeTalRef = (config: NonNullable<Awaited<ReturnType<typeof readProjectConfig>>>, talRef: DotTalRef | null) => {
    if (!talRef) return "none";
    if (talRef.kind === "preset") {
        const tal = findTal(talRef.slug);
        return tal ? `${tal.name} (${tal.slug})` : talRef.slug;
    }
    const custom = config.customTals.find((item) => item.id === talRef.id);
    return custom ? `${custom.tal.name} (${custom.tal.slug}, custom)` : `custom:${talRef.id}`;
};

export const describeDanceRef = (config: NonNullable<Awaited<ReturnType<typeof readProjectConfig>>>, danceRef: DotDanceRef | null) => {
    if (!danceRef) return "none";
    if (danceRef.kind === "preset") {
        const dance = findDance(danceRef.slug);
        return dance ? `${dance.name} (${dance.slug})` : danceRef.slug;
    }
    const custom = config.customDances.find((item) => item.id === danceRef.id);
    return custom ? `${custom.dance.name} (${custom.dance.slug}, custom)` : `custom:${danceRef.id}`;
};

export const refsEqual = <T extends { kind: "preset"; slug: string } | { kind: "custom"; id: string }>(a: T | null, b: T | null) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.kind !== b.kind) return false;
    return a.kind === "preset" ? a.slug === (b as { kind: "preset"; slug: string }).slug : a.id === (b as { kind: "custom"; id: string }).id;
};
