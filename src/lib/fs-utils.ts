/**
 * Shared filesystem utilities for skill operations.
 */
import fs from "fs";
import path from "path";

export interface CopySkillDirOptions {
    repoRoot?: string;
}

function isWithinDirectory(rootPath: string, targetPath: string): boolean {
    const relative = path.relative(rootPath, targetPath);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function describeRepoPath(repoRoot: string, sourcePath: string): string {
    const relative = path.relative(repoRoot, sourcePath);
    return relative && !relative.startsWith("..") ? relative : sourcePath;
}

function resolveRepoRoot(srcDir: string, options?: CopySkillDirOptions): string {
    const configuredRoot = options?.repoRoot
        ? path.resolve(options.repoRoot)
        : path.resolve(srcDir);
    return fs.realpathSync.native?.(configuredRoot) || fs.realpathSync(configuredRoot);
}

function copyFile(sourcePath: string, destinationPath: string): void {
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
}

function copyEntry(
    sourcePath: string,
    destinationPath: string,
    repoRoot: string,
    activeRealDirs: Set<string>,
): void {
    const name = path.basename(sourcePath);
    if (name.startsWith(".")) return;

    const sourceStat = fs.lstatSync(sourcePath);
    if (sourceStat.isSymbolicLink()) {
        const resolvedPath = fs.realpathSync(sourcePath);
        if (!isWithinDirectory(repoRoot, resolvedPath)) {
            throw new Error(
                `Skill bundle contains a symlink outside the repository root: ${describeRepoPath(repoRoot, sourcePath)}`,
            );
        }

        const resolvedStat = fs.statSync(resolvedPath);
        if (resolvedStat.isDirectory()) {
            copyDirectory(resolvedPath, destinationPath, repoRoot, activeRealDirs);
            return;
        }
        if (resolvedStat.isFile()) {
            copyFile(resolvedPath, destinationPath);
            return;
        }

        throw new Error(
            `Skill bundle symlink resolves to an unsupported file type: ${describeRepoPath(repoRoot, sourcePath)}`,
        );
    }

    if (sourceStat.isDirectory()) {
        copyDirectory(sourcePath, destinationPath, repoRoot, activeRealDirs);
        return;
    }
    if (sourceStat.isFile()) {
        copyFile(sourcePath, destinationPath);
    }
}

function copyDirectory(
    sourceDir: string,
    destinationDir: string,
    repoRoot: string,
    activeRealDirs: Set<string>,
): void {
    const realSourceDir = fs.realpathSync(sourceDir);
    if (!isWithinDirectory(repoRoot, realSourceDir)) {
        throw new Error(
            `Skill bundle resolves outside the repository root: ${describeRepoPath(repoRoot, sourceDir)}`,
        );
    }

    if (activeRealDirs.has(realSourceDir)) {
        throw new Error(
            `Skill bundle contains a cyclic symlinked directory: ${describeRepoPath(repoRoot, sourceDir)}`,
        );
    }

    activeRealDirs.add(realSourceDir);
    try {
        fs.mkdirSync(destinationDir, { recursive: true });
        const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
        for (const entry of entries) {
            copyEntry(
                path.join(sourceDir, entry.name),
                path.join(destinationDir, entry.name),
                repoRoot,
                activeRealDirs,
            );
        }
    } finally {
        activeRealDirs.delete(realSourceDir);
    }
}

/**
 * Recursively copies a skill directory, skipping hidden files.
 * Removes the destination directory first if it exists.
 */
export function copySkillDir(srcDir: string, destDir: string, options?: CopySkillDirOptions): void {
    if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
    }
    const repoRoot = resolveRepoRoot(srcDir, options);
    copyDirectory(srcDir, destDir, repoRoot, new Set());
}
