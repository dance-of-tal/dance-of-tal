import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { initRun, startRunContext, clearRun, getRunState } from "../lib/runs.js";
import { getCombo } from "../lib/registry.js";

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

const INIT_RUN_TOOL: Tool = {
  name: "init_run",
  description: "Initialize an isolated Dance of Tal execution context for a specific agent (Multi-Agent safety).",
  inputSchema: {
    type: "object",
    properties: {
      runId: {
        type: "string",
        description: "A unique identifier for this agent run or execution loop.",
      },
      comboName: {
        type: "string",
        description: "The name of the locked Type-Safe combo to use (e.g. 'FounderCombo').",
      },
    },
    required: ["runId", "comboName"],
  },
};

const GET_RUN_CONTEXT_TOOL: Tool = {
  name: "get_run_context",
  description: "Compile and retrieve the exact Prompt Payload (System Prompt + JSON Schema limiters) for an active run.",
  inputSchema: {
    type: "object",
    properties: {
      runId: {
        type: "string",
        description: "The unique identifier of the initialized run.",
      },
      taskContext: {
        type: "string",
        description: "A string describing the immediate task the agent needs to accomplish in this run.",
      }
    },
    required: ["runId", "taskContext"],
  },
};

const CLEAR_RUN_TOOL: Tool = {
  name: "clear_run",
  description: "Clear and garbage-collect a run identifier from the local runs directory.",
  inputSchema: {
    type: "object",
    properties: {
      runId: {
        type: "string",
      }
    },
    required: ["runId"]
  }
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [INIT_RUN_TOOL, GET_RUN_CONTEXT_TOOL, CLEAR_RUN_TOOL],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const cwd = process.cwd();

    if (request.params.name === "init_run") {
      const args = request.params.arguments as any;

      // Verify combo exists
      const combo = await getCombo(cwd, args.comboName);
      if (!combo) {
        throw new Error(`Cannot initialize run: Combo '${args.comboName}' not found in registry.`);
      }

      await initRun(cwd, args.runId, args.comboName);

      return {
        content: [
          {
            type: "text",
            text: `Successfully initialized isolated run '${args.runId}' using combo '${args.comboName}'.`,
          },
        ],
      };
    }

    if (request.params.name === "get_run_context") {
      const args = request.params.arguments as any;
      const compiled = await startRunContext(cwd, args.runId, args.taskContext);

      let responseText = `--- V2 ISOLATED CONTEXT [Run: ${args.runId}] ---\n\n`;
      responseText += `[SYSTEM PROMPT]\n${compiled.systemPrompt}\n\n`;

      if (compiled.schema) {
        responseText += `[ENFORCED JSON SCHEMA]\n${JSON.stringify(compiled.schema, null, 2)}`;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    }

    if (request.params.name === "clear_run") {
      const args = request.params.arguments as any;
      await clearRun(cwd, args.runId);
      return {
        content: [{ type: "text", text: `Run ${args.runId} cleared.` }]
      };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dance of Tal V2 - Type-Safe MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
