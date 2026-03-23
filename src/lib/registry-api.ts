import { isAssetKind } from "./kinds.js";
import { nameFromUrn } from "../contracts/index.js";

export const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal.workers.dev";

export interface RegistryPackageMeta {
    urn: string;
    kind: string;
    name: string;
    owner: string;
    stage: string;
    description: string;
    tags: string[];
    installs?: number;
    updatedAt?: string;
}

export interface DanceResource {
    type: string;
    repo: string;
    path: string;
    ref?: string;
}

export interface RegistryPackageDetail extends RegistryPackageMeta {
    payload?: Record<string, unknown>;
    resource?: DanceResource;
}

/**
 * Report a successful install to the registry (best-effort, fire-and-forget).
 * Increments the install counter in KV via the registry /install endpoint.
 */
export async function reportInstall(urn: string): Promise<void> {
    const parts = urn.split("/");
    if (parts.length !== 4) return;
    const [kind, ownerWithAt, stage, name] = parts;
    const owner = ownerWithAt.replace("@", "");
    try {
        await fetch(`${REGISTRY_URL}/registry/${kind}/${owner}/${stage}/${name}/install`, {
            method: "POST",
        });
    } catch {
        // Silently ignore — install count is best-effort
    }
}

export async function fetchRegistryPackageRaw(kind: string, owner: string, stage: string, name: string) {
    const url = `${REGISTRY_URL}/registry/${kind}/${owner}/${stage}/${name}`;
    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) {
            throw new Error(`Package '${kind}/@${owner}/${stage}/${name}' not found in registry.`);
        }
        throw new Error(`Registry error: ${res.statusText}`);
    }

    const { success, package: pkgData } = (await res.json()) as any;
    if (!success || !pkgData) {
        throw new Error("Invalid response from registry.");
    }

    return pkgData;
}

export async function getRegistryPackage(
    kind: string,
    owner: string,
    stage: string,
    name: string
): Promise<RegistryPackageDetail> {
    if (!isAssetKind(kind)) {
        throw new Error(`Invalid kind: '${kind}'. Allowed: tal, dance, act, performer`);
    }

    const normalizedOwner = owner.replace(/^@/, "");
    const pkgData = await fetchRegistryPackageRaw(kind, normalizedOwner, stage, name);

    if (typeof pkgData.urn !== "string" || !pkgData.urn) {
        throw new Error(`Registry response missing 'urn' for ${kind}/@${normalizedOwner}/${stage}/${name}`);
    }
    if (typeof pkgData.kind !== "string" || !pkgData.kind) {
        throw new Error(`Registry response missing 'kind' for ${pkgData.urn}`);
    }

    return {
        urn: pkgData.urn,
        kind: pkgData.kind,
        name: typeof pkgData.name === "string" ? pkgData.name : nameFromUrn(pkgData.urn),
        owner: typeof pkgData.owner === "string" ? pkgData.owner : normalizedOwner,
        stage: typeof pkgData.stage === "string" ? pkgData.stage : stage,
        description: typeof pkgData.description === "string" ? pkgData.description : "",
        tags: Array.isArray(pkgData.tags) ? pkgData.tags : [],
        installs: pkgData.installs,
        updatedAt: pkgData.updatedAt,
        ...(pkgData.payload ? { payload: pkgData.payload } : {}),
        ...(pkgData.resource ? { resource: pkgData.resource } : {}),
    };
}

/**
 * Searches the registry with a keyword query.
 */
export async function searchRegistry(
    query: string,
    options?: { kind?: string; tag?: string; limit?: number }
): Promise<RegistryPackageMeta[]> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (options?.kind) params.set("kind", options.kind);
    if (options?.tag) params.set("tag", options.tag);
    params.set("limit", String(options?.limit ?? 20));

    const url = `${REGISTRY_URL}/registry?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Registry search failed: ${res.statusText}`);

    const data = (await res.json()) as any;
    const packages = data.packages ?? [];

    return normalisePackages(packages);
}

/**
 * Lists all packages from the registry, optionally filtered by kind.
 */
export async function listRegistryPackages(
    options?: { kinds?: string[]; }
): Promise<RegistryPackageMeta[]> {
    const kinds = options?.kinds ?? ["tal", "dance", "act", "performer"];
    const allPackages: RegistryPackageMeta[] = [];

    await Promise.all(
        kinds.map(async (kind) => {
            const url = `${REGISTRY_URL}/registry?kind=${kind}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Registry error for kind '${kind}': ${res.statusText}`);
            const data = (await res.json()) as any;
            const packages = data.packages ?? [];
            allPackages.push(...normalisePackages(packages));
        })
    );

    return allPackages;
}

function normalisePackages(packages: any[]): RegistryPackageMeta[] {
    return packages.filter(Boolean).map((pkg: any) => ({
        urn: pkg.urn ?? `${pkg.kind ?? ""}/@${pkg.owner ?? ""}/${pkg.stage ?? ""}/${pkg.name ?? ""}`,
        kind: pkg.kind ?? "",
        name: pkg.name ?? "",
        owner: pkg.owner ?? "",
        stage: pkg.stage ?? "",
        description: pkg.description ?? "",
        tags: Array.isArray(pkg.tags) ? pkg.tags : [],
        installs: pkg.installs,
        updatedAt: pkg.updatedAt,
    }));
}
