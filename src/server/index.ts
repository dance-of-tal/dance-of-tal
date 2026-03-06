#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { installAsset } from "../lib/installer.js";
import { getDotDir, initRegistry } from "../lib/registry.js";
import { assertSafeAssetUrn } from "../lib/identifiers.js";
import { existsSync, statSync, realpathSync, type Dirent } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const SERVER_VERSION = "3.1.0";
const INSTALLABLE_KINDS = ["tal", "dance"] as const;
type InstallableKind = (typeof INSTALLABLE_KINDS)[number];

const SETUP_WORKSPACE_TOOL: Tool = {
  name: "setup_workspace",
  description:
    "Initialize the .dance-of-tal workspace directory for this project.",
  inputSchema: {
    type: "object",
    properties: {
      projectDir: {
        type: "string",
        description:
          "Optional absolute path to the project root directory. " +
          "Provide this when auto-detection is incorrect.",
      },
    },
    required: [],
  },
};

const INSTALL_ASSET_TOOL: Tool = {
  name: "install_asset",
  description:
    "Install a single Tal or Dance asset from the registry into .dance-of-tal/. " +
    "Only 'tal' and 'dance' kinds are supported.",
  inputSchema: {
    type: "object",
    properties: {
      urn: {
        type: "string",
        description: "Asset URN: tal/@<author>/<name> or dance/@<author>/<name>",
      },
      force: {
        type: "boolean",
        description: "If true, re-download and overwrite even when already installed.",
      },
      projectDir: {
        type: "string",
        description:
          "Optional absolute path to the project root directory. " +
          "Provide this when auto-detection is incorrect.",
      },
    },
    required: ["urn"],
  },
};

const LIST_ASSETS_TOOL: Tool = {
  name: "list_assets",
  description:
    "List installed local assets from .dance-of-tal/. Returns tal and dance assets.",
  inputSchema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: INSTALLABLE_KINDS,
        description: "Optional filter by kind: tal or dance.",
      },
      projectDir: {
        type: "string",
        description:
          "Optional absolute path to the project root directory. " +
          "Provide this when auto-detection is incorrect.",
      },
    },
    required: [],
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
  const dotDir = path.join(cwd, ".dance-of-tal");
  const talDir = path.join(dotDir, "tal");
  const danceDir = path.join(dotDir, "dance");

  return (
    existsSync(dotDir) &&
    isDirectory(dotDir) &&
    ((existsSync(talDir) && isDirectory(talDir)) ||
      (existsSync(danceDir) && isDirectory(danceDir)))
  );
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

const SUSPICIOUS_PATHS = new Set(["/", "/tmp", "/private/tmp"]);

function isSuspiciousCwd(dir: string): boolean {
  return SUSPICIOUS_PATHS.has(dir) || dir === os.homedir();
}

function parseInstallableKind(urn: string): InstallableKind {
  assertSafeAssetUrn(urn);
  const [kind] = urn.split("/");
  if (kind !== "tal" && kind !== "dance") {
    throw new Error(
      `Only 'tal' and 'dance' assets can be installed via MCP. Received kind: '${kind}'.`
    );
  }
  return kind;
}

type InstalledAssetInfo = {
  kind: InstallableKind;
  urn: string;
  author: string;
  name: string;
  filePath: string;
};

async function listInstalledAssets(
  cwd: string,
  kindFilter?: InstallableKind
): Promise<InstalledAssetInfo[]> {
  const dotDir = getDotDir(cwd);
  const kinds = kindFilter ? [kindFilter] : INSTALLABLE_KINDS;
  const assets: InstalledAssetInfo[] = [];

  for (const kind of kinds) {
    const kindDir = path.resolve(dotDir, kind);

    let authorEntries: Dirent[];
    try {
      authorEntries = await fs.readdir(kindDir, { withFileTypes: true });
    } catch (err: any) {
      if (err.code === "ENOENT") continue;
      throw err;
    }

    for (const authorEntry of authorEntries) {
      if (!authorEntry.isDirectory()) continue;
      if (!authorEntry.name.startsWith("@")) continue;

      const authorDir = path.resolve(kindDir, authorEntry.name);
      const fileEntries = await fs.readdir(authorDir, { withFileTypes: true });
      for (const fileEntry of fileEntries) {
        if (!fileEntry.isFile() || !fileEntry.name.endsWith(".json")) continue;

        const name = fileEntry.name.replace(/\.json$/, "");
        const author = authorEntry.name;
        assets.push({
          kind,
          urn: `${kind}/${author}/${name}`,
          author,
          name,
          filePath: path.resolve(authorDir, fileEntry.name),
        });
      }
    }
  }

  assets.sort((a, b) => a.urn.localeCompare(b.urn));
  return assets;
}

export function createServer(): Server {
  let sessionProjectDir: string | null = null;

  function resolveProjectCwd(overrideDir?: string): string {
    if (overrideDir?.trim()) {
      const resolved = path.resolve(overrideDir.trim());
      if (!existsSync(resolved)) {
        throw new Error(`Provided projectDir does not exist: ${resolved}`);
      }
      if (!isDirectory(resolved)) {
        throw new Error(`Provided projectDir is not a directory: ${resolved}`);
      }
      sessionProjectDir = resolved;
      return resolved;
    }

    if (sessionProjectDir) {
      return sessionProjectDir;
    }

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
      tools: [SETUP_WORKSPACE_TOOL, INSTALL_ASSET_TOOL, LIST_ASSETS_TOOL],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const args = (request.params.arguments ?? {}) as any;
      const cwd = resolveProjectCwd(args.projectDir);

      if (request.params.name === "setup_workspace") {
        const warnings: string[] = [];
        if (isSuspiciousCwd(cwd) && !args.projectDir) {
          warnings.push(
            `Resolved project directory is '${cwd}' which looks incorrect. ` +
            `Provide 'projectDir' with the absolute path to your project root.`
          );
        }

        if (hasWorkspaceLayout(cwd)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    resolvedProjectDir: cwd,
                    ...(warnings.length > 0 ? { warnings } : {}),
                    message: "Workspace already initialized.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        await initRegistry(cwd);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  resolvedProjectDir: cwd,
                  ...(warnings.length > 0 ? { warnings } : {}),
                  message: "Workspace initialized at .dance-of-tal/",
                  next: "Use install_asset with tal/@... or dance/@...",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (request.params.name === "install_asset") {
        const urn = typeof args.urn === "string" ? args.urn : "";
        const kind = parseInstallableKind(urn);

        if (!hasWorkspaceLayout(cwd)) {
          await initRegistry(cwd);
        }

        const result = await installAsset(cwd, urn, Boolean(args.force));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  kind,
                  urn: result.urn,
                  filePath: result.filePath,
                  skipped: result.skipped,
                  resolvedProjectDir: cwd,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (request.params.name === "list_assets") {
        const requestedKind = args.kind as InstallableKind | undefined;
        if (requestedKind && requestedKind !== "tal" && requestedKind !== "dance") {
          throw new Error("Invalid 'kind'. Allowed: tal, dance");
        }

        if (!hasWorkspaceLayout(cwd)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    assets: [],
                    count: 0,
                    resolvedProjectDir: cwd,
                    message: "Workspace not initialized. Call setup_workspace first.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const assets = await listInstalledAssets(cwd, requestedKind);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  assets,
                  count: assets.length,
                  resolvedProjectDir: cwd,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      throw new Error(`Unknown tool: ${request.params.name}`);
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });

  return server;
}

async function runServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Dance of Tal MCP Server v${SERVER_VERSION} (tools: ${3})`);
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
