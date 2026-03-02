import { describe, it, expect } from "vitest";
import { applyCodexStage } from "./codex.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("applyCodexStage", () => {
    it("should generate .codex/agents/dot-<combo>.md", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dot-test-"));

        const returnedPath = await applyCodexStage(tmpDir, {
            persona: "You are a backend engineer.",
            rules: "- Use TypeScript\n- Write unit tests",
            actDescription: "Refactor the API",
            comboName: "sprint",
        });

        expect(returnedPath).toBe(path.join(".codex", "agents", "dot-sprint.md"));

        const fullPath = path.join(tmpDir, returnedPath);
        const content = await fs.readFile(fullPath, "utf-8");
        expect(content).toContain("# Dance of Tal — AI Behavior Rules");
        expect(content).toContain("## Persona\nYou are a backend engineer.");
        expect(content).toContain("## Workflow\nRefactor the API");

        await fs.rm(tmpDir, { recursive: true, force: true });
    });
});
