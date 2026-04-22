import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { copySkillDir } from "./fs-utils.js";

let tempDir: string;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-utils-test-"));
});

afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("copySkillDir", () => {
    it("copies repo-local symlinked bundle folders as real directories", () => {
        const repoRoot = path.join(tempDir, "repo");
        const sharedAssetsDir = path.join(repoRoot, "assets");
        const skillDir = path.join(repoRoot, "skills", "privacy-eu");
        const destDir = path.join(tempDir, "installed", "privacy-eu");

        fs.mkdirSync(sharedAssetsDir, { recursive: true });
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(sharedAssetsDir, "terms.md"), "privacy terms");
        fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Privacy EU");
        fs.symlinkSync("../../assets", path.join(skillDir, "assets"));

        copySkillDir(skillDir, destDir, { repoRoot });

        expect(fs.readFileSync(path.join(destDir, "assets", "terms.md"), "utf-8")).toBe("privacy terms");
        const copiedAssetsStat = fs.lstatSync(path.join(destDir, "assets"));
        expect(copiedAssetsStat.isSymbolicLink()).toBe(false);
        expect(copiedAssetsStat.isDirectory()).toBe(true);
    });

    it("rejects symlinks that escape the repository root", () => {
        const repoRoot = path.join(tempDir, "repo");
        const externalDir = path.join(tempDir, "external-assets");
        const skillDir = path.join(repoRoot, "skills", "privacy-eu");
        const destDir = path.join(tempDir, "installed", "privacy-eu");

        fs.mkdirSync(externalDir, { recursive: true });
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(externalDir, "secret.txt"), "do not copy");
        fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Privacy EU");
        fs.symlinkSync(externalDir, path.join(skillDir, "assets"));

        expect(() => copySkillDir(skillDir, destDir, { repoRoot })).toThrow(
            "symlink outside the repository root",
        );
    });
});
