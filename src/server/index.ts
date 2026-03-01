#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { initRun, startRunContext, clearRun } from "../lib/runs.js";
import { getCombo, getDotDir } from "../lib/registry.js";
import { readAgentManifest } from "../lib/agents.js";
import { existsSync, readdirSync } from "fs";
import fs from "fs/promises";
import path from "path";

const server = new Server(
  {
    name: "dance-of-tal",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool Definitions ──────────────────────────────────────────────────────

const GET_PROJECT_STATUS_TOOL: Tool = {
  name: "get_project_status",
  description:
    "Dance of Tal (dot) is a Type-Safe AI Behavior Engine that uses Combos to enforce your persona and constraints. " +
    "Check the current Dance of Tal project state. " +
    "ALWAYS call this first before init_run or get_run_context. " +
    "Returns: whether the workspace is initialized, which combos are locally available, " +
    "which agent roles are mapped (agents.json), and the currently active combo. " +
    "If no combos are available, instruct the user to run 'dot use <combo-urn>' or 'dot quickstart'.",
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
    "Returns combo names, their tal/dance/act URNs, and the agents.json role→combo map.",
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

// ─── Handlers ─────────────────────────────────────────────────────────────

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
    const cwd = process.cwd();

    // ── get_project_status ──────────────────────────────────────────────
    if (request.params.name === "get_project_status") {
      const dotDir = getDotDir(cwd);
      const initialized = existsSync(dotDir);

      if (!initialized) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              initialized: false,
              message: "Workspace not initialized. Ask the user to run 'dot init' or 'dot quickstart'.",
            }, null, 2),
          }],
        };
      }

      const comboDir = path.join(dotDir, "combo");
      const combos = existsSync(comboDir)
        ? readdirSync(comboDir)
          .filter((f) => f.endsWith(".json"))
          .map((f) => f.replace(/\.json$/, ""))
        : [];

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
        const comboData = await getCombo(cwd, activeCombo).catch(() => null);
        if (comboData && comboData.act) {
          try {
            const actPath = path.join(dotDir, "assets", "act", ...comboData.act.split("/").slice(1)) + ".json";
            const actRaw = await fs.readFile(actPath, "utf-8");
            const actContent = JSON.parse(actRaw);
            const nodes = actContent.nodes || {};
            const startNode = Object.values(nodes)[0] as any;
            if (startNode && startNode.initialPrompt) {
              actInitialPrompt = startNode.initialPrompt;
            }
          } catch (e) {
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
            ...(actInitialPrompt ? {
              actInitialPrompt,
              _instruction: `This project is running an Act. Your FIRST message to the user MUST be exactly: "${actInitialPrompt}"`
            } : {}),
            hint: combos.length === 0
              ? "No combos found. Ask the user to run 'dot use combo/@<author>/<name>' or 'dot quickstart'."
              : `Use init_run with one of: ${combos.join(", ")}`,
          }, null, 2),
        }],
      };
    }

    // ── list_combos ─────────────────────────────────────────────────────
    if (request.params.name === "list_combos") {
      const dotDir = getDotDir(cwd);
      const comboDir = path.join(dotDir, "combo");

      if (!existsSync(dotDir) || !existsSync(comboDir)) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              combos: [],
              agents: {},
              message: "No combos found. Run 'dot use <combo-urn>' or 'dot quickstart' to get started.",
            }, null, 2),
          }],
        };
      }

      const comboFiles = readdirSync(comboDir).filter((f) => f.endsWith(".json"));
      const combos = await Promise.all(
        comboFiles.map(async (file) => {
          const name = file.replace(/\.json$/, "");
          const combo = await getCombo(cwd, name);
          return { name, ...combo };
        })
      );

      const agents = await readAgentManifest(cwd);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ combos, agents }, null, 2),
        }],
      };
    }

    // ── init_run ────────────────────────────────────────────────────────
    if (request.params.name === "init_run") {
      const args = request.params.arguments as any;

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
      const compiled = await startRunContext(cwd, args.runId, args.taskContext);

      let responseText = `--- V2 ISOLATED CONTEXT [Run: ${args.runId}] ---\n\n`;
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

// ─── Start ─────────────────────────────────────────────────────────────────

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dance of Tal V2 - MCP Server running (tools: get_project_status, list_combos, init_run, get_run_context, clear_run)");
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
