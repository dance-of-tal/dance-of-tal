import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { assetFilePath, readAsset } from "./registry.js";

describe("registry asset safety", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = fs.mkdtempSync(path.join(os.tmpdir(), "dot-test-"));
        fs.mkdirSync(path.join(cwd, ".dance-of-tal", "assets", "performer", "@acme"), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(cwd, { recursive: true, force: true });
    });

    it("resolves asset file path for performer URN", () => {
        const filePath = assetFilePath(cwd, "performer/@acme/sprint");
        expect(filePath).toContain(path.join(".dance-of-tal", "assets", "performer", "@acme", "sprint.json"));
    });

    it("reads installed performer asset from assets directory", async () => {
        const performerAsset = {
            $schema: "https://schemas.danceoftal.com/assets/performer.v1.json",
            kind: "performer",
            urn: "performer/@acme/sprint",
            description: "Sprint performer",
            tags: ["sprint"],
            payload: {
                tal: "tal/@acme/system-architect",
                dances: ["dance/@acme/json-structure"],
            },
        };
        const filePath = assetFilePath(cwd, "performer/@acme/sprint");
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(performerAsset, null, 2));

        const result = await readAsset(cwd, "performer/@acme/sprint");
        expect(result).toBeTruthy();
        expect((result as any).kind).toBe("performer");
        expect((result as any).payload.tal).toBe("tal/@acme/system-architect");
    });

    it("returns null for missing assets", async () => {
        const result = await readAsset(cwd, "performer/@acme/nonexistent");
        expect(result).toBeNull();
    });
});
