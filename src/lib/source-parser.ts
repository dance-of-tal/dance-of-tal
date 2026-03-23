/**
 * Parses GitHub shorthand and URLs into structured source information.
 *
 * Supported formats (matching vercel-labs/skills source-parser.ts):
 *   "owner/repo"                          → GitHub repo (default branch)
 *   "owner/repo@skill-name"              → GitHub repo, specific skill
 *   "owner/repo/path/to/skill"           → GitHub repo with subpath
 *   "https://github.com/o/r"             → GitHub repo URL
 *   "https://github.com/o/r/tree/main/p" → GitHub repo with ref and subpath
 */

export type ParsedSource = {
    type: "github";
    owner: string;
    repo: string;
    url: string;
    ref?: string;
    subpath?: string;
    skillFilter?: string;
};

/**
 * Sanitizes a subpath to prevent path traversal attacks.
 */
function sanitizeSubpath(subpath: string): string {
    const normalized = subpath.replace(/\\/g, "/");
    const segments = normalized.split("/");
    for (const segment of segments) {
        if (segment === "..") {
            throw new Error(
                `Unsafe subpath: "${subpath}" contains path traversal segments. ` +
                `Subpaths must not contain ".." components.`
            );
        }
    }
    return subpath;
}

export function parseSource(input: string): ParsedSource {
    const trimmed = input.trim();

    // GitHub URL with path: https://github.com/owner/repo/tree/branch/path/to/skill
    const githubTreeWithPathMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
    if (githubTreeWithPathMatch) {
        const [, owner, repo, ref, subpath] = githubTreeWithPathMatch;
        return {
            type: "github",
            owner: owner!,
            repo: repo!,
            url: `https://github.com/${owner}/${repo}.git`,
            ref,
            subpath: subpath ? sanitizeSubpath(subpath) : undefined,
        };
    }

    // GitHub URL with branch only: https://github.com/owner/repo/tree/branch
    const githubTreeMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)$/);
    if (githubTreeMatch) {
        const [, owner, repo, ref] = githubTreeMatch;
        return {
            type: "github",
            owner: owner!,
            repo: repo!,
            url: `https://github.com/${owner}/${repo}.git`,
            ref,
        };
    }

    // GitHub URL: https://github.com/owner/repo
    const githubRepoMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (githubRepoMatch) {
        const [, owner, repo] = githubRepoMatch;
        const cleanRepo = repo!.replace(/\.git$/, "");
        return {
            type: "github",
            owner: owner!,
            repo: cleanRepo,
            url: `https://github.com/${owner}/${cleanRepo}.git`,
        };
    }

    // Shorthand: owner/repo@skill-name
    const atSkillMatch = trimmed.match(/^([^/]+)\/([^/@]+)@(.+)$/);
    if (atSkillMatch && !trimmed.includes(":") && !trimmed.startsWith(".") && !trimmed.startsWith("/")) {
        const [, owner, repo, skillFilter] = atSkillMatch;
        return {
            type: "github",
            owner: owner!,
            repo: repo!,
            url: `https://github.com/${owner}/${repo}.git`,
            skillFilter,
        };
    }

    // Shorthand: owner/repo or owner/repo/subpath
    const shorthandMatch = trimmed.match(/^([^/]+)\/([^/]+)(?:\/(.+))?$/);
    if (shorthandMatch && !trimmed.includes(":") && !trimmed.startsWith(".") && !trimmed.startsWith("/")) {
        const [, owner, repo, subpath] = shorthandMatch;
        return {
            type: "github",
            owner: owner!,
            repo: repo!,
            url: `https://github.com/${owner}/${repo}.git`,
            subpath: subpath ? sanitizeSubpath(subpath) : undefined,
        };
    }

    throw new Error(
        `Cannot parse source: '${trimmed}'\n` +
        `  Expected: owner/repo, owner/repo@skill-name, owner/repo/subpath, or GitHub URL`
    );
}

/**
 * Builds a GitHub raw content URL for a file in a repo.
 */
export function githubRawUrl(owner: string, repo: string, ref: string, filePath: string): string {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
}

/**
 * Extracts owner/repo from a GitHub URL for lockfile tracking.
 */
export function getOwnerRepo(url: string): string | null {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    return `${match[1]}/${match[2].replace(/\.git$/, "")}`;
}
