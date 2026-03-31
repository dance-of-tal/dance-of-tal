import fs from "fs/promises";
import { assetFilePath } from "./registry.js";
import { getRegistryPackage, REGISTRY_URL } from "./registry-api.js";
import {
    parseActAsset,
    parseDotAsset,
    parseDotAssetUrn,
    parsePerformerAsset,
} from "../contracts/index.js";

export type PublishableKind = "tal" | "performer" | "act";

export type DependencyInfo = {
    urn: string;
    kind: PublishableKind;
    status: "exists" | "to_publish" | "foreign_missing" | "local_missing";
    payload?: Record<string, unknown>;
    tags?: string[];
    source?: "local" | "provided";
};

export type PublishAssetInput = {
    kind: PublishableKind;
    urn: string;
    payload: Record<string, unknown>;
    tags?: string[];
};

export type PublishPlan = {
    root: PublishAssetInput & { tags: string[] };
    dependencies: DependencyInfo[];
    publishQueue: Array<DependencyInfo & { status: "to_publish"; payload: Record<string, unknown>; tags: string[] }>;
    existing: string[];
    foreignMissing: string[];
    localMissing: string[];
};

export type PublishExecutionResult = {
    rootUrn: string;
    rootPublished: boolean;
    published: string[];
    skipped: string[];
    existing: string[];
    foreignMissing: string[];
    localMissing: string[];
};

export type ExecutePublishPlanOptions = {
    onPublishStart?: (entry: PublishAssetInput) => void;
    onPublishComplete?: (entry: PublishAssetInput, status: "published" | "skipped") => void;
};

export function parseUrn(urn: string): { kind: PublishableKind; owner: string; stage: string; name: string } | null {
    try {
        const parsed = parseDotAssetUrn(urn);
        if (parsed.kind === "dance") {
            return null;
        }
        return {
            kind: parsed.kind,
            owner: parsed.owner,
            stage: parsed.stage,
            name: parsed.name,
        };
    } catch {
        return null;
    }
}

export async function existsInRegistry(urn: string): Promise<boolean> {
    const parsed = parseUrn(urn);
    if (!parsed) {
        return false;
    }

    try {
        await getRegistryPackage(parsed.kind, parsed.owner, parsed.stage, parsed.name);
        return true;
    } catch {
        return false;
    }
}

export async function loadLocalAssetByUrn(
    cwd: string,
    urn: string
): Promise<Record<string, unknown> | null> {
    try {
        const filePath = assetFilePath(cwd, urn);
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw) as Record<string, unknown>;
    } catch (err: any) {
        if (err.code === "ENOENT") {
            return null;
        }
        throw err;
    }
}

export function getPayloadTags(payload: Record<string, unknown>): string[] {
    if (!Array.isArray(payload.tags)) {
        return [];
    }
    return payload.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
}

export function extractDependencyUrns(kind: string, payload: Record<string, unknown>): string[] {
    const urns: string[] = [];

    if (kind === "performer") {
        const performer = parsePerformerAsset(payload);
        if (typeof performer.payload.tal === "string") {
            urns.push(performer.payload.tal);
        }
        for (const danceUrn of performer.payload.dances || []) {
            urns.push(danceUrn);
        }
    } else if (kind === "act") {
        const act = parseActAsset(payload);
        for (const participant of act.payload.participants) {
            urns.push(participant.performer);
        }
    }

    return Array.from(new Set(urns));
}

function normalizePublishAssetInput(input: PublishAssetInput): PublishAssetInput & { tags: string[] } {
    const parsedUrn = parseUrn(input.urn);
    if (!parsedUrn) {
        throw new Error(`Publish only supports tal, performer, and act URNs. Received '${input.urn}'.`);
    }
    if (parsedUrn.kind !== input.kind) {
        throw new Error(`Input kind '${input.kind}' does not match URN '${input.urn}'.`);
    }

    const parsedAsset = parseDotAsset(input.payload);
    if (parsedAsset.kind === "dance") {
        throw new Error("Dance assets are not publishable through the cascade publish planner.");
    }
    if (parsedAsset.kind !== input.kind) {
        throw new Error(`Payload kind '${parsedAsset.kind}' does not match input kind '${input.kind}'.`);
    }
    if (parsedAsset.urn !== input.urn) {
        throw new Error(`Payload URN '${parsedAsset.urn}' does not match input URN '${input.urn}'.`);
    }

    return {
        kind: parsedUrn.kind,
        urn: parsedAsset.urn,
        payload: parsedAsset as Record<string, unknown>,
        tags: Array.isArray(input.tags) && input.tags.length > 0
            ? input.tags
            : getPayloadTags(parsedAsset as Record<string, unknown>),
    };
}

function extractPublishableDependencyUrns(kind: PublishableKind, payload: Record<string, unknown>): string[] {
    return extractDependencyUrns(kind, payload).filter((urn) => parseUrn(urn) !== null);
}

function formatMissingDependencyError(urns: string[], kind: "foreign_missing" | "local_missing") {
    if (kind === "foreign_missing") {
        return (
            "Cannot publish: the following dependencies are not in the registry and belong to other authors:\n"
            + urns.map((urn) => `  - ${urn}`).join("\n")
            + "\n\nAsk the respective authors to publish them first."
        );
    }

    return (
        "Cannot publish: the following dependencies belong to you but are not found locally:\n"
        + urns.map((urn) => `  - ${urn}`).join("\n")
        + "\n\nCreate or install them first with 'dot create' or 'dot install'."
    );
}

export async function buildPublishPlan(options: {
    cwd: string;
    username: string;
    root: PublishAssetInput;
    providedAssets?: Record<string, PublishAssetInput>;
}): Promise<PublishPlan> {
    const normalizedRoot = normalizePublishAssetInput(options.root);
    const rootUrn = parseUrn(normalizedRoot.urn);
    if (!rootUrn) {
        throw new Error(`Invalid publish root URN '${normalizedRoot.urn}'.`);
    }
    if (rootUrn.owner.toLowerCase() !== options.username.toLowerCase()) {
        throw new Error(`Root asset '${normalizedRoot.urn}' must belong to @${options.username}.`);
    }

    const normalizedProvided = new Map<string, PublishAssetInput & { tags: string[] }>();
    for (const [urn, asset] of Object.entries(options.providedAssets || {})) {
        const normalized = normalizePublishAssetInput(asset);
        if (normalized.urn !== urn) {
            throw new Error(`Provided asset map key '${urn}' must match payload URN '${normalized.urn}'.`);
        }
        const parsed = parseUrn(normalized.urn);
        if (!parsed) {
            throw new Error(`Unsupported provided asset URN '${normalized.urn}'.`);
        }
        if (parsed.owner.toLowerCase() !== options.username.toLowerCase()) {
            throw new Error(`Provided asset '${normalized.urn}' must belong to @${options.username}.`);
        }
        normalizedProvided.set(urn, normalized);
    }

    const dependencies: DependencyInfo[] = [];
    const publishQueue: Array<DependencyInfo & { status: "to_publish"; payload: Record<string, unknown>; tags: string[] }> = [];
    const existing: string[] = [];
    const foreignMissing: string[] = [];
    const localMissing: string[] = [];
    const visited = new Set<string>();

    async function resolveDependency(urn: string): Promise<void> {
        if (visited.has(urn)) return;
        visited.add(urn);

        const parsed = parseUrn(urn);
        if (!parsed) return;

        if (await existsInRegistry(urn)) {
            existing.push(urn);
            dependencies.push({ urn, kind: parsed.kind, status: "exists" });
            return;
        }

        const isMine = parsed.owner.toLowerCase() === options.username.toLowerCase();
        if (!isMine) {
            foreignMissing.push(urn);
            dependencies.push({ urn, kind: parsed.kind, status: "foreign_missing" });
            return;
        }

        const provided = normalizedProvided.get(urn);
        const depPayload = provided?.payload ?? await loadLocalAssetByUrn(options.cwd, urn);
        if (!depPayload) {
            localMissing.push(urn);
            dependencies.push({ urn, kind: parsed.kind, status: "local_missing" });
            return;
        }

        const normalizedDependency = provided ?? normalizePublishAssetInput({
            kind: parsed.kind,
            urn,
            payload: depPayload,
        });

        const subDeps = extractPublishableDependencyUrns(parsed.kind, normalizedDependency.payload);
        for (const subUrn of subDeps) {
            await resolveDependency(subUrn);
        }

        const dependencyInfo: DependencyInfo & { status: "to_publish"; payload: Record<string, unknown>; tags: string[] } = {
            urn,
            kind: parsed.kind,
            status: "to_publish",
            payload: normalizedDependency.payload,
            tags: normalizedDependency.tags,
            source: provided ? "provided" : "local",
        };
        dependencies.push(dependencyInfo);
        publishQueue.push(dependencyInfo);
    }

    const directDeps = extractPublishableDependencyUrns(normalizedRoot.kind, normalizedRoot.payload);
    for (const depUrn of directDeps) {
        await resolveDependency(depUrn);
    }

    return {
        root: normalizedRoot,
        dependencies,
        publishQueue,
        existing,
        foreignMissing,
        localMissing,
    };
}

export async function resolveDependencies(
    cwd: string,
    kind: PublishableKind,
    payload: Record<string, unknown>,
    myUsername: string
): Promise<DependencyInfo[]> {
    const parsedRoot = parseDotAsset(payload);
    if (parsedRoot.kind === "dance") {
        throw new Error("Dance assets cannot be resolved through the publish dependency planner.");
    }

    const plan = await buildPublishPlan({
        cwd,
        username: myUsername,
        root: {
            kind,
            urn: parsedRoot.urn,
            payload: parsedRoot as Record<string, unknown>,
        },
    });

    return plan.dependencies;
}

export async function publishSingleAsset(
    kind: PublishableKind,
    stage: string,
    name: string,
    payload: Record<string, unknown>,
    tags: string[],
    token: string
): Promise<boolean> {
    const res = await fetch(`${REGISTRY_URL}/publish`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kind, stage, name, tags, payload }),
    });

    if (!res.ok) {
        const errorData: any = await res.json().catch(() => ({}));
        if (res.status === 409) {
            return false;
        }
        throw new Error(errorData.error || res.statusText);
    }

    const result: any = await res.json();
    if (!result.success) {
        throw new Error(result.error || "Unknown error occurred");
    }
    return true;
}

export async function executePublishPlan(
    plan: PublishPlan,
    token: string,
    options: ExecutePublishPlanOptions = {},
): Promise<PublishExecutionResult> {
    if (plan.foreignMissing.length > 0) {
        throw new Error(formatMissingDependencyError(plan.foreignMissing, "foreign_missing"));
    }
    if (plan.localMissing.length > 0) {
        throw new Error(formatMissingDependencyError(plan.localMissing, "local_missing"));
    }

    const published: string[] = [];
    const skipped: string[] = [];
    const queue: PublishAssetInput[] = [
        ...plan.publishQueue.map((entry) => ({
            kind: entry.kind,
            urn: entry.urn,
            payload: entry.payload,
            tags: entry.tags,
        })),
        plan.root,
    ];

    for (const entry of queue) {
        const parsed = parseUrn(entry.urn);
        if (!parsed) {
            throw new Error(`Invalid publish queue entry '${entry.urn}'.`);
        }

        options.onPublishStart?.(entry);
        const didPublish = await publishSingleAsset(
            parsed.kind,
            parsed.stage,
            parsed.name,
            entry.payload,
            entry.tags || [],
            token,
        );

        if (didPublish) {
            published.push(entry.urn);
            options.onPublishComplete?.(entry, "published");
        } else {
            skipped.push(entry.urn);
            options.onPublishComplete?.(entry, "skipped");
        }
    }

    return {
        rootUrn: plan.root.urn,
        rootPublished: published.includes(plan.root.urn),
        published,
        skipped,
        existing: [...plan.existing],
        foreignMissing: [...plan.foreignMissing],
        localMissing: [...plan.localMissing],
    };
}
