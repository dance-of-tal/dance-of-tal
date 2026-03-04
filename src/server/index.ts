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
  initRegistry,
  listLockedComboNames,
} from "../lib/registry.js";
import { readAgentManifest } from "../lib/agents.js";
import { assertSafeComboName, assertSafeRunId } from "../lib/identifiers.js";
import { determineComboMode } from "../lib/engine.js";
import { installComboAndLock, searchRegistry } from "../lib/installer.js";
import { existsSync, statSync, realpathSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const SERVER_VERSION = "2.2.2";

// ─── Tool Definitions ──────────────────────────────────────────────────────

const GET_PROJECT_STATUS_TOOL: Tool = {
  name: "get_project_status",
  description:
    "Dance of Tal (DOT) is an Agent Manager for Agentic AI. " +
    "Call this FIRST to check workspace status. " +
    "Returns available combos, agent mappings, and setup guidance. " +
    "If workspace is not initialized, returns instructions for setup_workspace. " +
    "If no combos exist, returns instructions for install_combo.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const INIT_RUN_TOOL: Tool = {
  name: "init_run",
  description:
    "Initialize an isolated execution context for a specific agent run. " +
    "Provide EITHER comboName (direct) OR agentName (resolved via agents.json). " +
    "Priority: comboName > agentName. " +
    "After this, call get_run_context to receive your system prompt.",
  inputSchema: {
    type: "object",
    properties: {
      runId: {
        type: "string",
        description: "Unique identifier for this run (e.g. UUID).",
      },
      comboName: {
        type: "string",
        description: "Direct combo name (e.g. 'sprint'). Takes priority over agentName.",
      },
      agentName: {
        type: "string",
        description: "Agent name mapped in agents.json (e.g. 'reviewer'). Used if comboName is not provided.",
      },
    },
    required: ["runId"],
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

const SETUP_WORKSPACE_TOOL: Tool = {
  name: "setup_workspace",
  description:
    "Initialize the .dance-of-tal workspace directory. " +
    "Call this when get_project_status reports 'initialized: false'. " +
    "This only creates the directory structure — use install_combo to add packages.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const INSTALL_COMBO_TOOL: Tool = {
  name: "install_combo",
  description:
    "Install a combo from the registry and auto-lock it. " +
    "Downloads the combo and all its dependencies (tal, dance, act), " +
    "then creates a lockfile. Workspace must be initialized first (use setup_workspace). " +
    "Example URN: combo/@dot-preset/code-consultant",
  inputSchema: {
    type: "object",
    properties: {
      comboUrn: {
        type: "string",
        description: "Full combo URN: combo/@<author>/<name>",
      },
      localName: {
        type: "string",
        description: "Optional local name for the lockfile (defaults to the combo slug).",
      },
    },
    required: ["comboUrn"],
  },
};

const SEARCH_REGISTRY_TOOL: Tool = {
  name: "search_registry",
  description:
    "Search the DOT registry for available packages (combos, tals, dances, acts). " +
    "Use this to discover packages before installing.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (e.g. 'code review', 'security').",
      },
      kind: {
        type: "string",
        description: "Filter by kind: tal, dance, act, combo.",
        enum: ["tal", "dance", "act", "combo"],
      },
      limit: {
        type: "number",
        description: "Max results to return (default: 10).",
      },
    },
    required: [],
  },
};

const LIST_COMBOS_TOOL: Tool = {
  name: "list_combos",
  description:
    "List all locally installed and locked combos with their full details. " +
    "Use this to see what combos are available for init_run.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function isDirectory(targetPath: string): boolean {
  try {
    return statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function hasWorkspaceLayout(cwd: string): boolean {
  const dotDir = path.join(cwd, ".dance-of-tal");
  const comboDir = path.join(dotDir, "combo");
  return existsSync(dotDir) && isDirectory(dotDir) && existsSync(comboDir) && isDirectory(comboDir);
}

function findNearestWorkspaceRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    if (hasWorkspaceLayout(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function resolveProjectCwd(): string {
  const configured = process.env.DANCE_OF_TAL_PROJECT_DIR?.trim();
  if (configured) {
    const resolved = path.resolve(configured);
    if (!existsSync(resolved)) {
      throw new Error(`DANCE_OF_TAL_PROJECT_DIR does not exist: ${resolved}`);
    }
    if (!isDirectory(resolved)) {
      throw new Error(`DANCE_OF_TAL_PROJECT_DIR is not a directory: ${resolved}`);
    }
    return resolved;
  }

  const nearest = findNearestWorkspaceRoot(process.cwd());
  return nearest ?? process.cwd();
}

// ─── Server ────────────────────────────────────────────────────────────────

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
        SETUP_WORKSPACE_TOOL,
        INSTALL_COMBO_TOOL,
        SEARCH_REGISTRY_TOOL,
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const cwd = resolveProjectCwd();

      // ── get_project_status ──────────────────────────────────────────────
      if (request.params.name === "get_project_status") {
        const initialized = hasWorkspaceLayout(cwd);
        const warnings: string[] = [];

        if (!initialized) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                initialized: false,
                resolvedProjectDir: cwd,
                setup_guide: {
                  step1: "Call setup_workspace to initialize the workspace.",
                  step2: "Call search_registry to find a combo.",
                  step3: "Call install_combo with a combo URN.",
                  step4: "Call init_run + get_run_context to start.",
                },
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

        const manifest = await readAgentManifest(cwd);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              _mcp_guidance:
                "You are an AI agent operating via Dance of Tal (DOT). " +
                "To proceed: 1) Choose a combo from 'combos' list or use an agent from 'agents'. " +
                "2) Call init_run with comboName or agentName. " +
                "3) Call get_run_context to receive your system prompt.",
              initialized,
              resolvedProjectDir: cwd,
              combos,
              agents: manifest,
              ...(warnings.length > 0 ? { warnings } : {}),
              hint: combos.length === 0
                ? "No combos found. Use install_combo to install one from the registry."
                : `Use init_run with comboName (one of: ${combos.join(", ")}) or agentName.`,
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
                message: "Workspace not initialized. Call setup_workspace first.",
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
            return { name, mode: determineComboMode(combo), ...combo };
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
        if (args.comboName) assertSafeComboName(args.comboName);

        const state = await initRun(cwd, args.runId, args.comboName, args.agentName);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              runId: state.runId,
              resolvedComboName: state.resolvedComboName,
              mode: state.mode,
              ...(state.agentName ? { agentName: state.agentName } : {}),
              ...(state.actUrn ? { actUrn: state.actUrn } : {}),
              next: "Call get_run_context to receive your compiled system prompt.",
            }, null, 2),
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

      // ── setup_workspace ─────────────────────────────────────────────────
      if (request.params.name === "setup_workspace") {
        if (hasWorkspaceLayout(cwd)) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Workspace already initialized.",
                next: "Use install_combo to install a combo, or list_combos to see existing ones.",
              }, null, 2),
            }],
          };
        }

        await initRegistry(cwd);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Workspace initialized at .dance-of-tal/",
              next: "Use search_registry to find combos, then install_combo to install one.",
            }, null, 2),
          }],
        };
      }

      // ── install_combo ───────────────────────────────────────────────────
      if (request.params.name === "install_combo") {
        const args = request.params.arguments as any;
        if (!hasWorkspaceLayout(cwd)) {
          await initRegistry(cwd);
        }

        const result = await installComboAndLock(cwd, args.comboUrn, args.localName);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              comboUrn: result.comboUrn,
              localName: result.localName,
              lockfilePath: result.lockfilePath,
              assetsInstalled: result.installedAssets.length,
              assetsSkipped: result.installedAssets.filter(a => a.skipped).length,
              next: `Use init_run with comboName: '${result.localName}' to start a run.`,
            }, null, 2),
          }],
        };
      }

      // ── search_registry ─────────────────────────────────────────────────
      if (request.params.name === "search_registry") {
        const args = request.params.arguments as any;
        const results = await searchRegistry(args.query || "", {
          kind: args.kind,
          limit: args.limit ?? 10,
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              results,
              count: results.length,
              hint: results.length > 0
                ? `To install a combo, use install_combo with URN like: combo/@<author>/<name>`
                : "No results found. Try a different query or kind.",
            }, null, 2),
          }],
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

// ─── Bootstrap ─────────────────────────────────────────────────────────────

async function runServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Dance of Tal MCP Server v${SERVER_VERSION} (tools: ${8})`);
}

function isMainModule(): boolean {
  try {
    const scriptPath = realpathSync(fileURLToPath(import.meta.url));
    const mainArg = process.argv[1];
    if (!mainArg) return false;
    let mainPath: string;
    try {
      mainPath = realpathSync(mainArg);
    } catch {
      mainPath = path.resolve(mainArg);
    }
    return scriptPath === mainPath;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  runServer().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
