import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { assetFilePath, readAsset } from "./registry.js";

describe("registry asset safety", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = fs.mkdtempSync(path.join(os.tmpdir(), "dot-test-"));
        fs.mkdirSync(path.join(cwd, ".dance-of-tal", "assets", "performer", "@acme", "workflows"), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(cwd, { recursive: true, force: true });
    });

    it("resolves asset file path for performer URN", () => {
        const filePath = assetFilePath(cwd, "performer/@acme/workflows/sprint");
        expect(filePath).toContain(path.join(".dance-of-tal", "assets", "performer", "@acme", "workflows", "sprint.json"));
    });

    it("resolves asset file path for dance URN (SKILL.md directory)", () => {
        const filePath = assetFilePath(cwd, "dance/@acme/frontend-skills/code-review");
        expect(filePath).toContain(path.join(".dance-of-tal", "assets", "dance", "@acme", "frontend-skills", "code-review", "SKILL.md"));
    });

    it("reads installed performer asset from assets directory", async () => {
        const performerAsset = {
            kind: "performer",
            urn: "performer/@acme/workflows/sprint",
            description: "Sprint performer",
            tags: ["sprint"],
            payload: {
                tal: "tal/@acme/agent-presets/system-architect",
                dances: ["dance/@acme/frontend-skills/json-structure"],
            },
        };
        const filePath = assetFilePath(cwd, "performer/@acme/workflows/sprint");
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(performerAsset, null, 2));

        const result = await readAsset(cwd, "performer/@acme/workflows/sprint");
        expect(result).toBeTruthy();
        expect((result as any).kind).toBe("performer");
        expect((result as any).payload.tal).toBe("tal/@acme/agent-presets/system-architect");
    });

    it("returns null for missing assets", async () => {
        const result = await readAsset(cwd, "performer/@acme/workflows/nonexistent");
        expect(result).toBeNull();
    });
});
