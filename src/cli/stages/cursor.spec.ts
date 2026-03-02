import { describe, it, expect } from "vitest";
import { applyCursorStage, CursorVariant, CursorStageInput } from "./cursor.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("applyCursorStage", () => {
    it("should generate scoped .cursor/rules/dot-<combo>.mdc for cursor", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dot-test-"));

        const input: CursorStageInput = {
            persona: "You are an expert engineer.",
            rules: "- Always write tests\n- Be concise",
            actDescription: "Review the PR",
            comboName: "sprint",
        };

        const returnedPath = await applyCursorStage(tmpDir, "cursor", input);

        // Should output to scoped path
        expect(returnedPath).toBe(path.join(".cursor", "rules", "dot-sprint.mdc"));

        // File should exist with MDC frontmatter
        const fullPath = path.join(tmpDir, returnedPath);
        const content = await fs.readFile(fullPath, "utf-8");

        expect(content).toContain("---");
        expect(content).toContain("alwaysApply: false");
        expect(content).toContain("globs:");
        expect(content).toContain("# Dance of Tal — AI Behavior Rules");
        expect(content).toContain("## Persona\nYou are an expert engineer.");

        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("should generate .windsurfrules at project root for windsurf", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dot-test-"));

        const input: CursorStageInput = {
            persona: "You are an expert engineer.",
            rules: "- Always write tests",
        };

        const returnedPath = await applyCursorStage(tmpDir, "windsurf", input);
        expect(returnedPath).toBe(".windsurfrules");

        const fullPath = path.join(tmpDir, returnedPath);
        const content = await fs.readFile(fullPath, "utf-8");
        expect(content).toContain("# Dance of Tal — AI Behavior Rules");
        expect(content).not.toContain("---"); // No MDC frontmatter

        await fs.rm(tmpDir, { recursive: true, force: true });
    });
});
