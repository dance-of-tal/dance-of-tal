import { describe, it, expect } from "vitest";
import { applyClaudeStage } from "./claude.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("applyClaudeStage", () => {
    it("should generate .claude/CLAUDE.md", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dot-test-"));

        const returnedPath = await applyClaudeStage(tmpDir, {
            persona: "You are a security expert.",
            rules: "- Always check for SQL injection\n- Review auth flows",
            actDescription: "Security audit",
        });

        expect(returnedPath).toBe(path.join(".claude", "CLAUDE.md"));

        const fullPath = path.join(tmpDir, returnedPath);
        const content = await fs.readFile(fullPath, "utf-8");
        expect(content).toContain("# Dance of Tal — AI Behavior Rules");
        expect(content).toContain("## Persona\nYou are a security expert.");
        expect(content).toContain("## Workflow\nSecurity audit");

        await fs.rm(tmpDir, { recursive: true, force: true });
    });
});
