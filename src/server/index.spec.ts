import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./index.js";
import { assetFilePath, initRegistry, lockCombo } from "../lib/registry.js";

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function extractTextContent(result: any): string {
  const text = result?.content?.find((item: any) => item?.type === "text")?.text;
  if (typeof text !== "string") {
    throw new Error("Expected text content in MCP tool response.");
  }
  return text;
}

describe.sequential("MCP server tool flow", () => {
  let projectDir: string;
  let originalProjectEnv: string | undefined;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "dot-mcp-server-"));
    originalProjectEnv = process.env.DANCE_OF_TAL_PROJECT_DIR;
  });

  afterEach(async () => {
    if (originalProjectEnv === undefined) {
      delete process.env.DANCE_OF_TAL_PROJECT_DIR;
    } else {
      process.env.DANCE_OF_TAL_PROJECT_DIR = originalProjectEnv;
    }
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it("supports list -> init -> context -> clear flow with env project directory", async () => {
    await initRegistry(projectDir);

    await writeJson(assetFilePath(projectDir, "tal/@dot-presets/system-architect"), {
      type: "tal/@dot-presets/system-architect",
      slug: "system-architect",
      name: "System Architect",
      description: "Architect profile",
      category: "engineering",
      tags: [],
      featuredScore: 0,
      createdAt: "2026-03-02T00:00:00.000Z",
      thinking: "Think in systems.",
    });

    await writeJson(assetFilePath(projectDir, "dance/@dot-presets/json-structure"), {
      type: "dance/@dot-presets/json-structure",
      slug: "json-structure",
      name: "JSON Structure",
      description: "Respond in JSON.",
      category: "format",
      rules: "Always return valid JSON.",
      schema: { type: "object" },
    });

    await lockCombo(projectDir, "sprint", {
      tal: "tal/@dot-presets/system-architect",
      dance: "dance/@dot-presets/json-structure",
    });

    process.env.DANCE_OF_TAL_PROJECT_DIR = projectDir;

    const server = createServer();
    const client = new Client({ name: "dot-test-client", version: "1.0.0" });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((tool) => tool.name);
      expect(toolNames).toEqual([
        "get_project_status",
        "list_combos",
        "init_run",
        "get_run_context",
        "clear_run",
      ]);

      const statusResult = await client.callTool({ name: "get_project_status", arguments: {} });
      const statusPayload = JSON.parse(extractTextContent(statusResult));
      expect(statusPayload.initialized).toBe(true);
      expect(statusPayload.combos).toContain("sprint");

      const initResult = await client.callTool({
        name: "init_run",
        arguments: { runId: "run-e2e-001", comboName: "sprint" },
      });
      expect(extractTextContent(initResult)).toContain("Successfully initialized run");

      const contextResult = await client.callTool({
        name: "get_run_context",
        arguments: { runId: "run-e2e-001", taskContext: "Write regression tests" },
      });
      const contextText = extractTextContent(contextResult);
      expect(contextText).toContain("[SYSTEM PROMPT]");
      expect(contextText).toContain("[CURRENT TASK]");

      const clearResult = await client.callTool({
        name: "clear_run",
        arguments: { runId: "run-e2e-001" },
      });
      expect(extractTextContent(clearResult)).toContain("cleared");

      await expect(
        fs.access(path.join(projectDir, ".dance-of-tal", "runs", "run-e2e-001"))
      ).rejects.toThrow();
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  });

  it("returns warnings for malformed combo filenames instead of failing list_combos", async () => {
    await initRegistry(projectDir);
    await lockCombo(projectDir, "incident", {
      tal: "tal/@dot-presets/system-architect",
      dance: "dance/@dot-presets/json-structure",
    });

    const comboDir = path.join(projectDir, ".dance-of-tal", "combo");
    await fs.writeFile(path.join(comboDir, "bad name.json"), "{}", "utf-8");
    process.env.DANCE_OF_TAL_PROJECT_DIR = projectDir;

    const server = createServer();
    const client = new Client({ name: "dot-test-client", version: "1.0.0" });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const result = await client.callTool({ name: "list_combos", arguments: {} });
      const payload = JSON.parse(extractTextContent(result));
      expect(payload.combos.map((c: any) => c.name)).toContain("incident");
      expect(Array.isArray(payload.warnings)).toBe(true);
      expect(payload.warnings.length).toBeGreaterThan(0);
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  });

  it("reports clear errors when DANCE_OF_TAL_PROJECT_DIR is invalid", async () => {
    process.env.DANCE_OF_TAL_PROJECT_DIR = path.join(projectDir, "does-not-exist");

    const server = createServer();
    const client = new Client({ name: "dot-test-client", version: "1.0.0" });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const result = await client.callTool({ name: "get_project_status", arguments: {} });
      expect(result.isError).toBe(true);
      expect(extractTextContent(result)).toContain("DANCE_OF_TAL_PROJECT_DIR does not exist");
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  });
});

