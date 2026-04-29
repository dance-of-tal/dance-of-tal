import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { discoverSkills, toRepoPath } from "./skills.js";

let tempDir: string;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"));
});

afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeSkillMd(
    dir: string,
    name: string,
    description: string,
    extraFrontmatter = "",
): void {
    fs.mkdirSync(dir, { recursive: true });
    const content = [
        "---",
        `name: ${name}`,
        `description: ${description}`,
        extraFrontmatter,
        "---",
        "",
        "# Instructions",
        "Do something useful.",
    ]
        .filter(Boolean)
        .join("\n");
    fs.writeFileSync(path.join(dir, "SKILL.md"), content);
}

// -----------------------------------------------------------------------
// Root SKILL.md
// -----------------------------------------------------------------------
describe("root SKILL.md", () => {
    it("discovers SKILL.md at repo root", async () => {
        writeSkillMd(tempDir, "root-skill", "A root-level skill");
        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe("root-skill");
        expect(skills[0].description).toBe("A root-level skill");
        expect(skills[0].relativePath).toBe("");
    });

    it("discovers root AND subdirectory skills together", async () => {
        writeSkillMd(tempDir, "root-skill", "Root");
        writeSkillMd(path.join(tempDir, "canary"), "canary", "Canary skill");
        writeSkillMd(path.join(tempDir, "guard"), "guard", "Guard skill");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(3);
        const names = skills.map(s => s.name).sort();
        expect(names).toEqual(["canary", "guard", "root-skill"]);
    });
});

// -----------------------------------------------------------------------
// Priority directories
// -----------------------------------------------------------------------
describe("priority directories", () => {
    it("discovers skills in skills/ directory", async () => {
        writeSkillMd(path.join(tempDir, "skills", "review"), "review", "Code review skill");
        writeSkillMd(path.join(tempDir, "skills", "test"), "test", "Testing skill");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(2);
        const names = skills.map(s => s.name).sort();
        expect(names).toEqual(["review", "test"]);
    });

    it("discovers skills in skills/.curated/ directory", async () => {
        writeSkillMd(path.join(tempDir, "skills", ".curated", "curated-skill"), "curated-skill", "A curated skill");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe("curated-skill");
    });

    it("discovers skills in agent-skills/ directory", async () => {
        writeSkillMd(path.join(tempDir, "agent-skills", "my-skill"), "my-skill", "An agent skill");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe("my-skill");
    });

    it("deduplicates skills by name", async () => {
        writeSkillMd(path.join(tempDir, "skills", "review"), "review", "First");
        writeSkillMd(path.join(tempDir, "agent-skills", "review"), "review", "Duplicate");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].description).toBe("First"); // priority dir wins
    });
});

describe("repo paths", () => {
    it("normalizes Windows separators to GitHub repo separators", () => {
        expect(toRepoPath("skills\\pdf")).toBe("skills/pdf");
        expect(toRepoPath("skills\\output-formats\\financial-report")).toBe("skills/output-formats/financial-report");
    });
});

// -----------------------------------------------------------------------
// Recursive fallback
// -----------------------------------------------------------------------
describe("recursive fallback", () => {
    it("falls back to recursive discovery when no priority dirs match", async () => {
        writeSkillMd(path.join(tempDir, "custom", "deep", "skill"), "deep-skill", "Deeply nested");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe("deep-skill");
    });

    it("does not recurse into skill directories", async () => {
        // A skill with a subdirectory that also has SKILL.md (shouldn't discover sub)
        writeSkillMd(path.join(tempDir, "custom", "parent"), "parent", "Parent skill");
        writeSkillMd(path.join(tempDir, "custom", "parent", "sub"), "sub", "Sub skill");

        const skills = await discoverSkills(tempDir);
        const names = skills.map(s => s.name);
        expect(names).toContain("parent");
        expect(names).not.toContain("sub"); // stopped at parent
    });

    it("skips node_modules", async () => {
        writeSkillMd(path.join(tempDir, "node_modules", "pkg", "skill"), "hidden", "Should be skipped");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(0);
    });

    it("skips hidden directories (dot-prefixed)", async () => {
        writeSkillMd(path.join(tempDir, ".hidden", "skill"), "hidden", "Should be skipped");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(0);
    });

    it("respects maxDepth=5", async () => {
        // Create a skill at depth 6 — should NOT be found
        const deepPath = path.join(tempDir, "a", "b", "c", "d", "e", "f", "skill");
        writeSkillMd(deepPath, "too-deep", "Beyond max depth");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(0);
    });
});

// -----------------------------------------------------------------------
// Frontmatter parsing
// -----------------------------------------------------------------------
describe("frontmatter parsing", () => {
    it("extracts optional fields", async () => {
        writeSkillMd(
            path.join(tempDir, "skills", "full"),
            "full-skill",
            "Full featured skill",
            "license: MIT\ncompatibility: Requires Node 18+\nallowed-tools: read_file, write_file"
        );

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].license).toBe("MIT");
        expect(skills[0].compatibility).toBe("Requires Node 18+");
        expect(skills[0].allowedTools).toBe("read_file, write_file");
    });

    it("accepts array-style allowed-tools (YAML list)", async () => {
        const dir = path.join(tempDir, "skills", "arr-tools");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, "SKILL.md"),
            [
                "---",
                "name: arr-tools",
                "description: Skill with array allowed-tools",
                "allowed-tools:",
                "  - Bash",
                "  - Read",
                "  - AskUserQuestion",
                "---",
                "",
                "# Instructions",
                "Do something.",
            ].join("\n"),
        );

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].allowedTools).toBe("Bash, Read, AskUserQuestion");
    });

    it("extracts tags from metadata", async () => {
        writeSkillMd(
            path.join(tempDir, "skills", "tagged"),
            "tagged-skill",
            "Skill with tags",
            'metadata:\n  tags:\n    - review\n    - backend\n  category: productivity'
        );

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(1);
        expect(skills[0].tags).toContain("review");
        expect(skills[0].tags).toContain("backend");
        expect(skills[0].tags).toContain("productivity");
    });

    it("skips SKILL.md without name", async () => {
        const dir = path.join(tempDir, "skills", "bad");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "SKILL.md"), "---\ndescription: no name\n---\n# Test\n");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(0);
    });

    it("skips SKILL.md without description", async () => {
        const dir = path.join(tempDir, "skills", "bad");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "SKILL.md"), "---\nname: no-desc\n---\n# Test\n");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(0);
    });

    it("skips invalid YAML frontmatter", async () => {
        const dir = path.join(tempDir, "skills", "bad");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "SKILL.md"), "Not a SKILL.md file at all");

        const skills = await discoverSkills(tempDir);
        expect(skills).toHaveLength(0);
    });

    it("includes rawContent", async () => {
        writeSkillMd(path.join(tempDir, "skills", "content"), "content-skill", "Has content");

        const skills = await discoverSkills(tempDir);
        expect(skills[0].rawContent).toContain("name: content-skill");
        expect(skills[0].rawContent).toContain("# Instructions");
    });
});

// -----------------------------------------------------------------------
// Empty directory
// -----------------------------------------------------------------------
describe("empty directory", () => {
    it("returns empty array for empty directory", async () => {
        const skills = await discoverSkills(tempDir);
        expect(skills).toEqual([]);
    });
});
