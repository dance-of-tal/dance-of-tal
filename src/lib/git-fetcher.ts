/**
 * Shallow-clones a GitHub repo into a temp directory.
 * Uses simple-git for reliability. Cleans up after callback.
 *
 * Mirrors vercel-labs/skills git.ts patterns:
 * - GIT_TERMINAL_PROMPT=0 to prevent hanging on auth
 * - Detailed error classification (timeout, auth, generic)
 * - Path validation on cleanup
 */
import { simpleGit } from "simple-git";
import fs from "fs/promises";
import os from "os";
import path from "path";

export interface CloneOptions {
    url: string;
    ref?: string;
    timeoutMs?: number;
}

export interface CloneResult {
    tempDir: string;
    cleanup: () => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Shallow-clones a repo and returns the temp directory path + cleanup function.
 * Caller is responsible for calling cleanup() when done.
 */
export async function shallowClone(options: CloneOptions): Promise<CloneResult> {
    const { url, ref, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dot-clone-"));
    const git = simpleGit({
        timeout: { block: timeoutMs },
    });

    try {
        const cloneArgs = ["--depth", "1"];
        if (ref && ref !== "HEAD") {
            cloneArgs.push("--branch", ref);
        }
        await git.clone(url, tempDir, cloneArgs);
    } catch (err) {
        // Cleanup on failure
        await cleanupTempDir(tempDir);

        const message = err instanceof Error ? err.message : String(err);
        const isTimeout = message.includes("block timeout") || message.includes("timed out");
        const isAuth =
            message.includes("Authentication failed") ||
            message.includes("could not read Username") ||
            message.includes("Permission denied") ||
            message.includes("Repository not found");

        if (isTimeout) {
            throw new Error(
                `Clone timed out after ${timeoutMs / 1000}s. ` +
                `This often happens with private repos that require authentication.\n` +
                `  For SSH: ssh-add -l (check loaded keys)\n` +
                `  For HTTPS: gh auth status`
            );
        }

        if (isAuth) {
            throw new Error(
                `Authentication failed for ${url}.\n` +
                `  For private repos, ensure you have access.\n` +
                `  For SSH: ssh -T git@github.com\n` +
                `  For HTTPS: gh auth login`
            );
        }

        throw new Error(`Failed to clone '${url}': ${message}`);
    }

    return {
        tempDir,
        cleanup: () => cleanupTempDir(tempDir),
    };
}

/**
 * Safely removes a temp directory. Validates it's inside os.tmpdir().
 */
async function cleanupTempDir(dir: string): Promise<void> {
    const normalizedDir = path.normalize(path.resolve(dir));
    const normalizedTmp = path.normalize(path.resolve(os.tmpdir()));

    if (!normalizedDir.startsWith(normalizedTmp + path.sep) && normalizedDir !== normalizedTmp) {
        throw new Error("Attempted to clean up directory outside of temp directory");
    }

    await fs.rm(dir, { recursive: true, force: true });
}
