import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
    readSkillLock,
    writeSkillLock,
    upsertSkillLockEntry,
    removeSkillLockEntry,
    listLockedSkills,
} from "./skill-lock.js";

let tempDir: string;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-lock-test-"));
    // Create .dance-of-tal dir
    fs.mkdirSync(path.join(tempDir, ".dance-of-tal"), { recursive: true });
});

afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("readSkillLock", () => {
    it("returns empty lock when file does not exist", async () => {
        const lock = await readSkillLock(tempDir);
        expect(lock.version).toBe(1);
        expect(lock.skills).toEqual({});
    });

    it("reads valid lock file", async () => {
        const lockData = {
            version: 1,
            skills: {
                "dance/@acme/frontend-skills/review": {
                    source: "github",
                    sourceUrl: "https://github.com/acme/frontend-skills",
                    skillPath: "skills/review",
                    skillFolderHash: "abc123",
                    installedAt: "2026-01-01T00:00:00Z",
                    updatedAt: "2026-01-02T00:00:00Z",
                },
            },
        };
        fs.writeFileSync(
            path.join(tempDir, ".dance-of-tal", "skill-lock.json"),
            JSON.stringify(lockData),
        );

        const lock = await readSkillLock(tempDir);
        expect(lock.version).toBe(1);
        expect(Object.keys(lock.skills)).toHaveLength(1);
        expect(lock.skills["dance/@acme/frontend-skills/review"].sourceUrl).toBe(
            "https://github.com/acme/frontend-skills",
        );
    });

    it("returns empty lock for corrupted JSON", async () => {
        fs.writeFileSync(
            path.join(tempDir, ".dance-of-tal", "skill-lock.json"),
            "not json{{{",
        );

        const lock = await readSkillLock(tempDir);
        expect(lock.version).toBe(1);
        expect(lock.skills).toEqual({});
    });

    it("returns empty lock for invalid version", async () => {
        fs.writeFileSync(
            path.join(tempDir, ".dance-of-tal", "skill-lock.json"),
            JSON.stringify({ version: 99, skills: {} }),
        );

        const lock = await readSkillLock(tempDir);
        expect(lock.skills).toEqual({});
    });
});

describe("writeSkillLock", () => {
    it("writes valid lock file", async () => {
        const lock = {
            version: 1 as const,
            skills: {
                "dance/@test/repo/my-skill": {
                    source: "github" as const,
                    sourceUrl: "https://github.com/test/repo",
                    skillPath: "skills/my-skill",
                    installedAt: "2026-01-01T00:00:00Z",
                    updatedAt: "2026-01-01T00:00:00Z",
                },
            },
        };

        await writeSkillLock(tempDir, lock);

        const raw = fs.readFileSync(
            path.join(tempDir, ".dance-of-tal", "skill-lock.json"),
            "utf-8",
        );
        const parsed = JSON.parse(raw);
        expect(parsed.version).toBe(1);
        expect(parsed.skills["dance/@test/repo/my-skill"].sourceUrl).toBe(
            "https://github.com/test/repo",
        );
    });

    it("formats JSON with 2-space indent", async () => {
        await writeSkillLock(tempDir, { version: 1, skills: {} });

        const raw = fs.readFileSync(
            path.join(tempDir, ".dance-of-tal", "skill-lock.json"),
            "utf-8",
        );
        expect(raw).toContain("  "); // 2-space indent
        expect(raw).not.toContain("\t"); // no tabs
    });
});

describe("upsertSkillLockEntry", () => {
    it("creates new entry with installedAt timestamp", async () => {
        await upsertSkillLockEntry(tempDir, "dance/@acme/repo/review", {
            source: "github",
            sourceUrl: "https://github.com/acme/repo",
            skillPath: "skills/review",
            skillFolderHash: "abc123",
        });

        const lock = await readSkillLock(tempDir);
        const entry = lock.skills["dance/@acme/repo/review"];
        expect(entry).toBeDefined();
        expect(entry.source).toBe("github");
        expect(entry.sourceUrl).toBe("https://github.com/acme/repo");
        expect(entry.skillPath).toBe("skills/review");
        expect(entry.skillFolderHash).toBe("abc123");
        expect(entry.installedAt).toBeDefined();
        expect(entry.updatedAt).toBeDefined();
    });

    it("preserves installedAt on update", async () => {
        // First insert
        await upsertSkillLockEntry(tempDir, "dance/@acme/repo/review", {
            source: "github",
            sourceUrl: "https://github.com/acme/repo",
            skillPath: "skills/review",
        });

        const first = await readSkillLock(tempDir);
        const originalInstalledAt = first.skills["dance/@acme/repo/review"].installedAt;

        // Wait a tiny bit and update
        await new Promise(r => setTimeout(r, 10));

        await upsertSkillLockEntry(tempDir, "dance/@acme/repo/review", {
            source: "github",
            sourceUrl: "https://github.com/acme/repo",
            skillPath: "skills/review",
            skillFolderHash: "new-hash",
        });

        const second = await readSkillLock(tempDir);
        const entry = second.skills["dance/@acme/repo/review"];
        expect(entry.installedAt).toBe(originalInstalledAt); // preserved
        expect(entry.skillFolderHash).toBe("new-hash"); // updated
    });

    it("handles multiple entries", async () => {
        await upsertSkillLockEntry(tempDir, "dance/@a/repo/skill-1", {
            source: "github",
            sourceUrl: "https://github.com/a/repo",
            skillPath: "skills/skill-1",
        });
        await upsertSkillLockEntry(tempDir, "dance/@b/repo/skill-2", {
            source: "github",
            sourceUrl: "https://github.com/b/repo",
            skillPath: "skills/skill-2",
        });

        const lock = await readSkillLock(tempDir);
        expect(Object.keys(lock.skills)).toHaveLength(2);
    });
});

describe("removeSkillLockEntry", () => {
    it("removes existing entry", async () => {
        await upsertSkillLockEntry(tempDir, "dance/@acme/repo/review", {
            source: "github",
            sourceUrl: "https://github.com/acme/repo",
            skillPath: "skills/review",
        });

        await removeSkillLockEntry(tempDir, "dance/@acme/repo/review");

        const lock = await readSkillLock(tempDir);
        expect(lock.skills["dance/@acme/repo/review"]).toBeUndefined();
    });

    it("does nothing for non-existent entry", async () => {
        await removeSkillLockEntry(tempDir, "dance/@missing/repo/skill");

        const lock = await readSkillLock(tempDir);
        expect(Object.keys(lock.skills)).toHaveLength(0);
    });
});

describe("listLockedSkills", () => {
    it("returns empty array when no skills", async () => {
        const urns = await listLockedSkills(tempDir);
        expect(urns).toEqual([]);
    });

    it("returns all URNs", async () => {
        await upsertSkillLockEntry(tempDir, "dance/@a/repo/s1", {
            source: "github",
            sourceUrl: "https://github.com/a/repo",
            skillPath: "s1",
        });
        await upsertSkillLockEntry(tempDir, "dance/@b/repo/s2", {
            source: "github",
            sourceUrl: "https://github.com/b/repo",
            skillPath: "s2",
        });

        const urns = await listLockedSkills(tempDir);
        expect(urns).toHaveLength(2);
        expect(urns).toContain("dance/@a/repo/s1");
        expect(urns).toContain("dance/@b/repo/s2");
    });
});
