/**
 * Shared filesystem utilities for skill operations.
 */
import fs from "fs";
import path from "path";

/**
 * Recursively copies a skill directory, skipping hidden files.
 * Removes the destination directory first if it exists.
 */
export function copySkillDir(srcDir: string, destDir: string): void {
    if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
    }
    fs.mkdirSync(destDir, { recursive: true });

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.name.startsWith(".")) continue; // skip hidden files
        if (entry.isDirectory()) {
            copySkillDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
