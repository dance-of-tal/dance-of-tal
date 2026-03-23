import { describe, it, expect } from "vitest";
import { parseSource, getOwnerRepo, githubRawUrl } from "./source-parser.js";

describe("parseSource", () => {
    // -----------------------------------------------------------------------
    // Shorthand: owner/repo
    // -----------------------------------------------------------------------
    describe("owner/repo shorthand", () => {
        it("parses basic owner/repo", () => {
            const result = parseSource("acme/frontend-skills");
            expect(result.type).toBe("github");
            expect(result.owner).toBe("acme");
            expect(result.repo).toBe("frontend-skills");
            expect(result.url).toBe("https://github.com/acme/frontend-skills.git");
            expect(result.ref).toBeUndefined();
            expect(result.subpath).toBeUndefined();
            expect(result.skillFilter).toBeUndefined();
        });

        it("trims whitespace", () => {
            const result = parseSource("  acme/repo  ");
            expect(result.owner).toBe("acme");
            expect(result.repo).toBe("repo");
        });
    });

    // -----------------------------------------------------------------------
    // Shorthand: owner/repo@skill
    // -----------------------------------------------------------------------
    describe("owner/repo@skill shorthand", () => {
        it("parses @skill filter", () => {
            const result = parseSource("acme/repo@code-review");
            expect(result.owner).toBe("acme");
            expect(result.repo).toBe("repo");
            expect(result.skillFilter).toBe("code-review");
            expect(result.subpath).toBeUndefined();
        });

        it("handles multi-word skill names", () => {
            const result = parseSource("acme/repo@my-complex-skill");
            expect(result.skillFilter).toBe("my-complex-skill");
        });
    });

    // -----------------------------------------------------------------------
    // Shorthand: owner/repo/subpath
    // -----------------------------------------------------------------------
    describe("owner/repo/subpath shorthand", () => {
        it("parses single-depth subpath", () => {
            const result = parseSource("acme/repo/skills");
            expect(result.owner).toBe("acme");
            expect(result.repo).toBe("repo");
            expect(result.subpath).toBe("skills");
        });

        it("parses multi-depth subpath", () => {
            const result = parseSource("acme/repo/skills/code-review");
            expect(result.owner).toBe("acme");
            expect(result.repo).toBe("repo");
            expect(result.subpath).toBe("skills/code-review");
        });

        it("rejects path traversal in subpath", () => {
            expect(() => parseSource("acme/repo/../etc/passwd")).toThrow("path traversal");
        });
    });

    // -----------------------------------------------------------------------
    // GitHub URLs
    // -----------------------------------------------------------------------
    describe("GitHub URL", () => {
        it("parses basic GitHub URL", () => {
            const result = parseSource("https://github.com/acme/frontend-skills");
            expect(result.owner).toBe("acme");
            expect(result.repo).toBe("frontend-skills");
            expect(result.url).toBe("https://github.com/acme/frontend-skills.git");
        });

        it("strips .git suffix from URL", () => {
            const result = parseSource("https://github.com/acme/frontend-skills.git");
            expect(result.repo).toBe("frontend-skills");
            expect(result.url).toBe("https://github.com/acme/frontend-skills.git");
        });

        it("parses tree URL with branch only", () => {
            const result = parseSource("https://github.com/acme/repo/tree/develop");
            expect(result.owner).toBe("acme");
            expect(result.repo).toBe("repo");
            expect(result.ref).toBe("develop");
            expect(result.subpath).toBeUndefined();
        });

        it("parses tree URL with branch and subpath", () => {
            const result = parseSource("https://github.com/acme/repo/tree/main/skills/review");
            expect(result.owner).toBe("acme");
            expect(result.repo).toBe("repo");
            expect(result.ref).toBe("main");
            expect(result.subpath).toBe("skills/review");
        });

        it("parses tree URL with multi-depth subpath", () => {
            const result = parseSource("https://github.com/acme/repo/tree/v2/packages/skills/review");
            expect(result.ref).toBe("v2");
            expect(result.subpath).toBe("packages/skills/review");
        });
    });

    // -----------------------------------------------------------------------
    // Error cases
    // -----------------------------------------------------------------------
    describe("error cases", () => {
        it("throws on empty string", () => {
            expect(() => parseSource("")).toThrow("Cannot parse source");
        });

        it("throws on single word", () => {
            expect(() => parseSource("justarepo")).toThrow("Cannot parse source");
        });

        it("throws on relative path", () => {
            expect(() => parseSource("./local/path")).toThrow("Cannot parse source");
        });

        it("throws on absolute path", () => {
            expect(() => parseSource("/absolute/path")).toThrow("Cannot parse source");
        });
    });
});

describe("getOwnerRepo", () => {
    it("extracts owner/repo from GitHub URL", () => {
        expect(getOwnerRepo("https://github.com/acme/frontend-skills")).toBe("acme/frontend-skills");
    });

    it("strips .git suffix", () => {
        expect(getOwnerRepo("https://github.com/acme/repo.git")).toBe("acme/repo");
    });

    it("returns null for non-GitHub URL", () => {
        expect(getOwnerRepo("https://gitlab.com/acme/repo")).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(getOwnerRepo("")).toBeNull();
    });
});

describe("githubRawUrl", () => {
    it("builds correct raw content URL", () => {
        expect(githubRawUrl("acme", "repo", "main", "skills/review/SKILL.md"))
            .toBe("https://raw.githubusercontent.com/acme/repo/main/skills/review/SKILL.md");
    });
});
