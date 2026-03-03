#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { initRun, startRunContext, clearRun } from "../lib/runs.js";
import {
  assetFilePath,
  getCombo,
  getDotDir,
  listLockedComboNames,
} from "../lib/registry.js";
import { readAgentManifest } from "../lib/agents.js";
import { assertSafeComboName, assertSafeRunId } from "../lib/identifiers.js";
import { existsSync, realpathSync, statSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const SERVER_VERSION = "2.1.2";

// ─── Tool Definitions ──────────────────────────────────────────────────────

const GET_PROJECT_STATUS_TOOL: Tool = {
  name: "get_project_status",
  description:
    "Dance of Tal (dot) is a Type-Safe AI Behavior Engine that uses Combos to enforce your persona and constraints. " +
    "Check the current Dance of Tal project state. " +
    "ALWAYS call this first before init_run or get_run_context. " +
    "Returns: whether the workspace is initialized, which combos are locally available, " +
    "which agent roles are mapped (agents.json), and the currently active combo. " +
    "If no combos are available, instruct the user to run 'dot use <combo-urn>'.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const LIST_COMBOS_TOOL: Tool = {
  name: "list_combos",
  description:
    "List all locally installed combos and agent role mappings for this project. " +
    "Use this to discover valid comboName values before calling init_run. " +
    "Returns combo names, their tal/dance/act URNs, and the agents.json role→combo map. " +
    "If malformed combo files exist, they are skipped and returned in warnings.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const INIT_RUN_TOOL: Tool = {
  name: "init_run",
  description:
    "Initialize an isolated Dance of Tal execution context for a specific agent run. " +
    "PREREQUISITE: the comboName must exist locally — call list_combos first to find valid names. " +
    "If you know the agent role (e.g. 'reviewer'), map it to a combo via the agents field from list_combos. " +
    "Use a unique runId (e.g. a UUID or descriptive string) for multi-agent isolation.",
  inputSchema: {
    type: "object",
    properties: {
      runId: {
        type: "string",
        description: "A unique identifier for this agent run (e.g. 'run-pr-review-001').",
      },
      comboName: {
        type: "string",
        description: "The local combo name to use (e.g. 'sprint', 'pr-review'). Get valid names from list_combos.",
      },
    },
    required: ["runId", "comboName"],
  },
};

const GET_RUN_CONTEXT_TOOL: Tool = {
  name: "get_run_context",
  description:
    "Compile and retrieve the full Prompt Payload (System Prompt + JSON Schema) for an active run. " +
    "Call this after init_run. The returned system prompt tells you exactly how to behave for this task. " +
    "Apply the system prompt to your own behavior for the duration of this task.",
  inputSchema: {
    type: "object",
    properties: {
      runId: {
        type: "string",
        description: "The unique identifier of the initialized run (same as used in init_run).",
      },
      taskContext: {
        type: "string",
        description: "A string describing the immediate task the agent needs to accomplish in this run.",
      },
    },
    required: ["runId", "taskContext"],
  },
};

const CLEAR_RUN_TOOL: Tool = {
  name: "clear_run",
  description:
    "Clear and garbage-collect a run after it completes. Call this when done to keep the runs/ directory clean.",
  inputSchema: {
    type: "object",
    properties: {
      runId: {
        type: "string",
        description: "The run identifier to clear.",
      },
    },
    required: ["runId"],
  },
};

function isDirectory(targetPath: string): boolean {
  try {
    return statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function hasWorkspaceLayout(cwd: string): boolean {
  const dotDir = getDotDir(cwd);
  const comboDir = path.join(dotDir, "combo");
  return isDirectory(dotDir) && isDirectory(comboDir);
}

function findNearestWorkspaceRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    if (hasWorkspaceLayout(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function resolveProjectCwd(): string {
  const configured = process.env.DANCE_OF_TAL_PROJECT_DIR?.trim();
  if (!configured) {
    const discovered = findNearestWorkspaceRoot(process.cwd());
    return discovered ?? process.cwd();
  }

  const resolved = path.resolve(configured);
  if (!existsSync(resolved)) {
    throw new Error(`DANCE_OF_TAL_PROJECT_DIR does not exist: ${resolved}`);
  }
  if (!statSync(resolved).isDirectory()) {
    throw new Error(`DANCE_OF_TAL_PROJECT_DIR is not a directory: ${resolved}`);
  }

  return resolved;
}

export function createServer(): Server {
  const server = new Server(
    {
      name: "dance-of-tal",
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        GET_PROJECT_STATUS_TOOL,
        LIST_COMBOS_TOOL,
        INIT_RUN_TOOL,
        GET_RUN_CONTEXT_TOOL,
        CLEAR_RUN_TOOL,
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const cwd = resolveProjectCwd();

      // ── get_project_status ──────────────────────────────────────────────
      if (request.params.name === "get_project_status") {
        const dotDir = getDotDir(cwd);
        const initialized = hasWorkspaceLayout(cwd);
        const warnings: string[] = [];

        if (!initialized) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                initialized: false,
                message: "Workspace not initialized. Ask the user to run 'dot init', then 'dot use <combo-urn>'.",
              }, null, 2),
            }],
          };
        }

        const { names: combos, skipped } = await listLockedComboNames(cwd);
        if (skipped.length > 0) {
          warnings.push(
            ...skipped.map((item) => `Skipped malformed combo filename '${item.file}': ${item.reason}`)
          );
        }

        const configPath = path.join(dotDir, "combo.config.json");
        const [configRaw, manifest] = await Promise.all([
          fs.readFile(configPath, "utf-8").catch(() => "{}"),
          readAgentManifest(cwd)
        ]);

        const config = JSON.parse(configRaw);
        const activeCombo = config.activeCombo || null;
        let actInitialPrompt: string | undefined = undefined;

        // If there is an active combo and it belongs to an Act, try to find an initialPrompt
        if (activeCombo) {
          let comboData = null;
          try {
            assertSafeComboName(activeCombo);
            comboData = await getCombo(cwd, activeCombo);
          } catch (err: any) {
            warnings.push(`Invalid activeCombo '${activeCombo}' in combo.config.json: ${err.message}`);
          }
          if (comboData && comboData.act) {
            try {
              const actPath = assetFilePath(cwd, comboData.act);
              const actRaw = await fs.readFile(actPath, "utf-8");
              const actContent = JSON.parse(actRaw);
              const nodes = actContent.nodes || {};
              const startNode = Object.values(nodes)[0] as any;
              if (startNode && startNode.initialPrompt) {
                actInitialPrompt = startNode.initialPrompt;
              }
            } catch {
              // ignore if act file is missing or invalid
            }
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              _mcp_guidance: "You are an AI agent operating via Dance of Tal (DOT). To proceed: 1) Identify your appropriate combo from the 'combos' or 'agents' list. 2) Call 'init_run' with that combo. 3) Call 'get_run_context' to receive your strictly-typed system prompt and JSON schema. You MUST adhere to the returned constraints.",
              initialized,
              combos,
              agents: manifest,
              activeCombo,
              ...(warnings.length > 0 ? { warnings } : {}),
              ...(actInitialPrompt ? {
                actInitialPrompt,
                _instruction: `This project is running an Act. Your FIRST message to the user MUST be exactly: "${actInitialPrompt}"`
              } : {}),
              hint: combos.length === 0
                ? "No combos found. Ask the user to run 'dot use combo/@<author>/<name>'."
                : `Use init_run with one of: ${combos.join(", ")}`,
            }, null, 2),
          }],
        };
      }

      // ── list_combos ─────────────────────────────────────────────────────
      if (request.params.name === "list_combos") {
        if (!hasWorkspaceLayout(cwd)) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                combos: [],
                agents: {},
                message: "No combos found. Run 'dot use <combo-urn>' to get started.",
              }, null, 2),
            }],
          };
        }

        const { names, skipped } = await listLockedComboNames(cwd);
        const warnings: string[] = skipped.map(
          (item) => `Skipped malformed combo filename '${item.file}': ${item.reason}`
        );

        const comboSettled = await Promise.allSettled(
          names.map(async (name) => {
            const combo = await getCombo(cwd, name);
            if (!combo) throw new Error(`Combo '${name}' is missing or unreadable.`);
            return { name, ...combo };
          })
        );

        const combos: Array<Record<string, unknown>> = [];
        comboSettled.forEach((result, idx) => {
          const name = names[idx];
          if (result.status === "fulfilled") {
            combos.push(result.value);
            return;
          }
          warnings.push(`Skipped combo '${name}': ${result.reason?.message || "unknown error"}`);
        });

        const agents = await readAgentManifest(cwd);

        return {
          content: [{
            type: "text",
            text: JSON.stringify(
              {
                combos,
                agents,
                ...(warnings.length > 0 ? { warnings } : {}),
              },
              null,
              2
            ),
          }],
        };
      }

      // ── init_run ────────────────────────────────────────────────────────
      if (request.params.name === "init_run") {
        const args = request.params.arguments as any;
        assertSafeRunId(args.runId);
        assertSafeComboName(args.comboName);

        const combo = await getCombo(cwd, args.comboName);
        if (!combo) {
          throw new Error(
            `Combo '${args.comboName}' not found. Call list_combos to see available options.`
          );
        }

        await initRun(cwd, args.runId, args.comboName);

        return {
          content: [{
            type: "text",
            text: `Successfully initialized run '${args.runId}' using combo '${args.comboName}'. Now call get_run_context to retrieve the compiled system prompt.`,
          }],
        };
      }

      // ── get_run_context ─────────────────────────────────────────────────
      if (request.params.name === "get_run_context") {
        const args = request.params.arguments as any;
        assertSafeRunId(args.runId);
        const compiled = await startRunContext(cwd, args.runId, args.taskContext);

        let responseText = `--- ISOLATED CONTEXT [Run: ${args.runId}] ---\n\n`;
        responseText += `[SYSTEM PROMPT]\n${compiled.systemPrompt}\n\n`;

        if (compiled.schema) {
          responseText += `[ENFORCED JSON SCHEMA]\n${JSON.stringify(compiled.schema, null, 2)}`;
        }

        responseText += `\n\n---\nApply the above system prompt to your behavior for this task.`;

        return {
          content: [{ type: "text", text: responseText }],
        };
      }

      // ── clear_run ───────────────────────────────────────────────────────
      if (request.params.name === "clear_run") {
        const args = request.params.arguments as any;
        assertSafeRunId(args.runId);
        await clearRun(cwd, args.runId);
        return {
          content: [{ type: "text", text: `Run '${args.runId}' cleared.` }],
        };
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  });

  return server;
}

export async function runServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dance of Tal MCP Server running (tools: get_project_status, list_combos, init_run, get_run_context, clear_run)");
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const modulePath = fileURLToPath(import.meta.url);

  try {
    // npx/npm bin shims often invoke the script through a symlink.
    // Compare real paths so the main check works in both direct and shimmed execution.
    return realpathSync(path.resolve(entry)) === realpathSync(modulePath);
  } catch {
    return path.resolve(entry) === path.resolve(modulePath);
  }
}

if (isMainModule()) {
  runServer().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
