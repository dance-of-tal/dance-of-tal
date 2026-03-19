import fs from "fs/promises";
import { assetFilePath } from "./registry.js";
import { getRegistryPackage } from "./installer.js";
import { isAssetKind } from "./kinds.js";
import { parseActAsset, parsePerformerAsset } from "../contracts/index.js";

const REGISTRY_URL =
    process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal.workers.dev";

export type PublishableKind = "tal" | "dance" | "performer" | "act";

export type DependencyInfo = {
    urn: string;
    status: "exists" | "to_publish" | "foreign_missing";
    payload?: Record<string, unknown>;
};

export function parseUrn(urn: string): { kind: PublishableKind; author: string; name: string } | null {
    const parts = urn.split("/");
    if (parts.length !== 3 || !parts[1].startsWith("@") || !isAssetKind(parts[0])) {
        return null;
    }
    return {
        kind: parts[0] as PublishableKind,
        author: parts[1].slice(1),
        name: parts[2],
    };
}

export async function existsInRegistry(urn: string): Promise<boolean> {
    const parsed = parseUrn(urn);
    if (!parsed) {
        return false;
    }

    try {
        await getRegistryPackage(parsed.kind, parsed.author, parsed.name);
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
            for (const danceUrn of participant.activeDances || []) {
                urns.push(danceUrn);
            }
        }
    }

    return Array.from(new Set(urns));
}

export async function resolveDependencies(
    cwd: string,
    kind: PublishableKind,
    payload: Record<string, unknown>,
    myUsername: string
): Promise<DependencyInfo[]> {
    const result: DependencyInfo[] = [];
    const visited = new Set<string>();

    async function resolve(urn: string): Promise<void> {
        if (visited.has(urn)) {
            return;
        }
        visited.add(urn);

        const parsed = parseUrn(urn);
        if (!parsed) {
            return;
        }

        if (await existsInRegistry(urn)) {
            result.push({ urn, status: "exists" });
            return;
        }

        const isMine = parsed.author.toLowerCase() === myUsername.toLowerCase();
        if (!isMine) {
            result.push({ urn, status: "foreign_missing" });
            return;
        }

        const depPayload = await loadLocalAssetByUrn(cwd, urn);
        if (!depPayload) {
            result.push({ urn, status: "foreign_missing" });
            return;
        }

        const subDeps = extractDependencyUrns(parsed.kind, depPayload);
        for (const subUrn of subDeps) {
            await resolve(subUrn);
        }

        result.push({ urn, status: "to_publish", payload: depPayload });
    }

    const directDeps = extractDependencyUrns(kind, payload);
    for (const depUrn of directDeps) {
        await resolve(depUrn);
    }

    return result;
}

export async function publishSingleAsset(
    kind: PublishableKind,
    slug: string,
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
        body: JSON.stringify({ kind, name: slug, tags, payload }),
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
