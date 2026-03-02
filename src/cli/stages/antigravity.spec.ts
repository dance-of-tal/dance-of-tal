import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyAntigravityStage } from "./antigravity.js";
import { Skill } from "./skills-parser.js";

describe("applyAntigravityStage", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dot-stage-ag-"));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("writes workflow files for each skill", async () => {
        const skills: Skill[] = [
            {
                name: "deploy-to-staging",
                description: "Deploy to staging server",
                instructions: "1. npm run build\n2. wrangler deploy --env staging",
            },
            {
                name: "run-tests",
                description: "Run the test suite",
                instructions: "1. npm test\n2. Report results",
            },
        ];

        const written = await applyAntigravityStage(tmpDir, skills);
        expect(written).toHaveLength(2);

        const file1 = await fs.readFile(
            path.join(tmpDir, ".agents/workflows/deploy-to-staging.md"),
            "utf-8"
        );
        expect(file1).toContain("---");
        expect(file1).toContain("description: Deploy to staging server");
        expect(file1).toContain("npm run build");

        const file2 = await fs.readFile(
            path.join(tmpDir, ".agents/workflows/run-tests.md"),
            "utf-8"
        );
        expect(file2).toContain("description: Run the test suite");
        expect(file2).toContain("npm test");
    });

    it("returns empty array when no skills are provided", async () => {
        const written = await applyAntigravityStage(tmpDir, []);
        expect(written).toHaveLength(0);

        // Ensure .agents/workflows was NOT created
        await expect(
            fs.access(path.join(tmpDir, ".agents/workflows"))
        ).rejects.toThrow();
    });

    it("converts camelCase names to kebab-case filenames", async () => {
        const skills: Skill[] = [
            {
                name: "runUnitTests",
                description: "Run unit tests",
                instructions: "npm test",
            },
        ];

        const written = await applyAntigravityStage(tmpDir, skills);
        expect(written[0]).toContain("run-unit-tests.md");
    });
});
