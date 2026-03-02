import { describe, expect, it } from "vitest";
import { parseSkills } from "./skills-parser.js";

describe("parseSkills", () => {
    it("returns empty array when no ## Skills section exists", () => {
        const rules = `## Output Rules\n- Always respond in Korean\n- Follow JSON schema`;
        expect(parseSkills(rules)).toEqual([]);
    });

    it("parses a single skill", () => {
        const rules = [
            "## Output Rules",
            "- Respond in JSON",
            "",
            "## Skills",
            "### deploy-to-staging",
            "Deploy the app to staging server",
            "1. npm run build",
            "2. wrangler deploy --env staging",
        ].join("\n");

        const skills = parseSkills(rules);
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe("deploy-to-staging");
        expect(skills[0].description).toBe("Deploy the app to staging server");
        expect(skills[0].instructions).toContain("npm run build");
        expect(skills[0].instructions).toContain("wrangler deploy");
    });

    it("parses multiple skills", () => {
        const rules = [
            "## Skills",
            "### deploy-to-staging",
            "Deploy the app to staging",
            "1. npm run build",
            "2. wrangler deploy",
            "",
            "### run-tests",
            "Run the test suite",
            "1. npm test",
            "2. Report results",
        ].join("\n");

        const skills = parseSkills(rules);
        expect(skills).toHaveLength(2);
        expect(skills[0].name).toBe("deploy-to-staging");
        expect(skills[1].name).toBe("run-tests");
        expect(skills[1].description).toBe("Run the test suite");
    });

    it("stops parsing at the next ## heading", () => {
        const rules = [
            "## Skills",
            "### my-skill",
            "A skill description",
            "Do something",
            "",
            "## Other Section",
            "This is not a skill",
        ].join("\n");

        const skills = parseSkills(rules);
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe("my-skill");
        expect(skills[0].instructions).not.toContain("This is not a skill");
    });

    it("handles skills with multi-line instructions", () => {
        const rules = [
            "## Skills",
            "### complex-workflow",
            "A complex workflow with many steps",
            "Step 1: Do X",
            "Step 2: Do Y",
            "  - Sub-step A",
            "  - Sub-step B",
            "Step 3: Do Z",
        ].join("\n");

        const skills = parseSkills(rules);
        expect(skills).toHaveLength(1);
        expect(skills[0].instructions).toContain("Sub-step A");
        expect(skills[0].instructions).toContain("Step 3: Do Z");
    });

    it("returns empty description when skill has no body", () => {
        const rules = [
            "## Skills",
            "### empty-skill",
        ].join("\n");

        const skills = parseSkills(rules);
        expect(skills).toHaveLength(1);
        expect(skills[0].name).toBe("empty-skill");
        expect(skills[0].description).toBe("");
        expect(skills[0].instructions).toBe("");
    });
});
