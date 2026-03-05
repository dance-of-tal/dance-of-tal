import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assetFilePath, lockCombo } from "./registry.js";
import { clearRun, getRunDir, getRunState, initRun, startRunContext } from "./runs.js";

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

describe("runs safety and context compilation", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "dot-runs-"));
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("rejects unsafe run identifiers", () => {
    expect(() => getRunDir(cwd, "../escape")).toThrow("Invalid runId");
  });

  it("initializes and clears run state safely", async () => {
    // V3: initRun now validates combo exists
    const { initRegistry } = await import("./registry.js");
    await initRegistry(cwd);
    await lockCombo(cwd, "sprint", {
      tal: "tal/@test/persona",
      dance: "dance/@test/rules",
    });

    await initRun(cwd, "run-1", "sprint");
    const state = await getRunState(cwd, "run-1");
    expect(state?.status).toBe("initialized");
    expect(state?.resolvedComboName).toBe("sprint");
    expect(state?.mode).toBeDefined();

    await clearRun(cwd, "run-1");
    const afterClear = await getRunState(cwd, "run-1");
    expect(afterClear).toBeNull();
  });

  it("includes act workflow information in compiled context", async () => {
    await writeJson(assetFilePath(cwd, "tal/@acme/system-architect"), {
      type: "tal/@acme/system-architect",
      slug: "system-architect",
      name: "System Architect",
      description: "Architect profile",
      tags: [],
      featuredScore: 0,
      createdAt: "2026-03-01T00:00:00.000Z",
      content: "Think in systems.",
    });

    await writeJson(assetFilePath(cwd, "dance/@acme/json-structure"), {
      type: "dance/@acme/json-structure",
      slug: "json-structure",
      name: "JSON Structure",
      description: "Respond in JSON.",
      tags: [],
      content: "Always return valid JSON.",
      schema: { type: "object" },
    });

    await writeJson(assetFilePath(cwd, "act/@acme/incident-response"), {
      type: "act/@acme/incident-response",
      slug: "incident-response",
      name: "Incident Response",
      description: "Incident workflow",
      steps: ["triage", "hotfix", "postmortem"],
    });

    await lockCombo(cwd, "incident", {
      tal: "tal/@acme/system-architect",
      dance: "dance/@acme/json-structure",
      act: "act/@acme/incident-response",
    });

    await initRun(cwd, "run-incident", "incident");
    const compiled = await startRunContext(cwd, "run-incident", "Handle P0 outage");

    expect(compiled.systemPrompt).toContain("[WORKFLOW ACT: act/@acme/incident-response]");
    expect(compiled.systemPrompt).toContain("Steps: triage -> hotfix -> postmortem");
  });
});
