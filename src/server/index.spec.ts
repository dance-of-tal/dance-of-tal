import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./index.js";
import { assetFilePath } from "../lib/registry.js";

function extractTextContent(result: any): string {
  const text = result?.content?.find((item: any) => item?.type === "text")?.text;
  if (typeof text !== "string") {
    throw new Error("Expected text content in MCP tool response.");
  }
  return text;
}

describe.sequential("MCP server minimal tool flow", () => {
  let projectDir: string;
  let originalProjectEnv: string | undefined;
  let originalCwd: string;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "dot-mcp-server-"));
    originalProjectEnv = process.env.DANCE_OF_TAL_PROJECT_DIR;
    originalCwd = process.cwd();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalProjectEnv === undefined) {
      delete process.env.DANCE_OF_TAL_PROJECT_DIR;
    } else {
      process.env.DANCE_OF_TAL_PROJECT_DIR = originalProjectEnv;
    }
    process.chdir(originalCwd);
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it("exposes setup/install/list/read MCP tools", async () => {
    const server = createServer();
    const client = new Client({ name: "dot-test-client", version: "1.0.0" });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const tools = await client.listTools();
      const toolNames = tools.tools.map((tool) => tool.name);
      expect(toolNames).toEqual([
        "setup_workspace",
        "install_asset",
        "list_assets",
        "load_capability_context",
      ]);
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  });

  it("supports setup -> install tal -> list assets", async () => {
    process.env.DANCE_OF_TAL_PROJECT_DIR = projectDir;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          package: {
            payload: {
              type: "tal/@acme/system-architect",
              slug: "system-architect",
              name: "System Architect",
              description: "Architect profile",
              tags: [],
              featuredScore: 0,
              createdAt: "2026-03-06T00:00:00.000Z",
              content: "Think in systems.",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const server = createServer();
    const client = new Client({ name: "dot-test-client", version: "1.0.0" });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const setupResult = await client.callTool({
        name: "setup_workspace",
        arguments: {},
      });
      const setupPayload = JSON.parse(extractTextContent(setupResult));
      expect(setupPayload.success).toBe(true);

      const urn = "tal/@acme/system-architect";
      const installResult = await client.callTool({
        name: "install_asset",
        arguments: { urn },
      });
      const installPayload = JSON.parse(extractTextContent(installResult));
      expect(installPayload.success).toBe(true);
      expect(installPayload.kind).toBe("tal");
      expect(installPayload.urn).toBe(urn);
      expect(installPayload.skipped).toBe(false);

      const expectedPath = assetFilePath(projectDir, urn);
      await expect(fs.access(expectedPath)).resolves.toBeUndefined();

      const listResult = await client.callTool({ name: "list_assets", arguments: {} });
      const listPayload = JSON.parse(extractTextContent(listResult));
      expect(listPayload.count).toBe(1);
      expect(listPayload.assets[0].urn).toBe(urn);
      expect(listPayload.assets[0].kind).toBe("tal");
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  });

  it("reads installed asset content on demand", async () => {
    process.env.DANCE_OF_TAL_PROJECT_DIR = projectDir;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          package: {
            payload: {
              type: "dance/@acme/pr-review",
              slug: "pr-review",
              name: "PR Review",
              description: "Review pull requests carefully.",
              tags: ["review"],
              content: "Check correctness, tests, and regressions.",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const server = createServer();
    const client = new Client({ name: "dot-test-client", version: "1.0.0" });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      await client.callTool({ name: "setup_workspace", arguments: {} });
      await client.callTool({
        name: "install_asset",
        arguments: { urn: "dance/@acme/pr-review" },
      });

      const result = await client.callTool({
        name: "load_capability_context",
        arguments: { urn: "dance/@acme/pr-review" },
      });
      const payload = JSON.parse(extractTextContent(result));
      expect(payload.success).toBe(true);
      expect(payload.kind).toBe("dance");
      expect(payload.description).toBe("Review pull requests carefully.");
      expect(payload.content).toBe("Check correctness, tests, and regressions.");
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  });

  it("rejects non-tal/dance kinds for install_asset", async () => {
    process.env.DANCE_OF_TAL_PROJECT_DIR = projectDir;

    const server = createServer();
    const client = new Client({ name: "dot-test-client", version: "1.0.0" });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const result = await client.callTool({
        name: "install_asset",
        arguments: { urn: "performer/@acme/reviewer" },
      });
      expect(result.isError).toBe(true);
      expect(extractTextContent(result)).toContain("Only 'tal' and 'dance' assets");
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
      const result = await client.callTool({ name: "list_assets", arguments: {} });
      expect(result.isError).toBe(true);
      expect(extractTextContent(result)).toContain("DANCE_OF_TAL_PROJECT_DIR does not exist");
    } finally {
      await Promise.allSettled([client.close(), server.close()]);
    }
  });
});
