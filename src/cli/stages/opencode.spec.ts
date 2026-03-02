import { describe, it, expect } from "vitest";
import { applyOpenCodeStage } from "./opencode.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("applyOpenCodeStage", () => {
    it("should generate .opencode/rules/dot-<combo>.md", async () => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dot-test-"));

        const returnedPath = await applyOpenCodeStage(tmpDir, {
            persona: "You are a frontend engineer.",
            rules: "- Use React\n- Follow accessibility guidelines",
            comboName: "ui-review",
        });

        expect(returnedPath).toBe(path.join(".opencode", "rules", "dot-ui-review.md"));

        const fullPath = path.join(tmpDir, returnedPath);
        const content = await fs.readFile(fullPath, "utf-8");
        expect(content).toContain("# Dance of Tal — AI Behavior Rules");
        expect(content).toContain("## Persona\nYou are a frontend engineer.");

        await fs.rm(tmpDir, { recursive: true, force: true });
    });
});
