export type InitTargetHost = "windsurf" | "claude" | "openclaw" | "cursor" | "gpts" | "other";
export type DeployStage = "gpts" | "mcp" | "openclaw" | "threads" | "my-aws-server";
export type InitWizardMode = "init-only" | "tal-only" | "dance-only" | "combo";
export type InitWizardSourceType = "preset" | "custom";

export const isDeployStage = (value: string): value is DeployStage => {
    return value === "gpts" || value === "mcp" || value === "openclaw" || value === "threads" || value === "my-aws-server";
};

export const resolveTargetHost = (value?: string): InitTargetHost => {
    const normalized = (value || "").trim().toLowerCase();
    if (normalized === "windsurf") return "windsurf";
    if (normalized === "claude" || normalized === "claude-desktop") return "claude";
    if (normalized === "openclaw" || normalized === "openclaw.ai") return "openclaw";
    if (normalized === "cursor") return "cursor";
    if (normalized === "gpts" || normalized === "chatgpt" || normalized === "gpt") return "gpts";
    if (normalized === "other") return "other";
    return "claude";
};

export const buildTargetSetup = (targetHost: InitTargetHost) => {
    if (targetHost === "windsurf") {
        return {
            host: "windsurf",
            steps: [
                "Open Windsurf MCP settings and register a local stdio server.",
                "Set command: npx",
                "Set args: -y dance-of-tal",
                "Reload MCP tools and run: act_overview."
            ]
        };
    }
    if (targetHost === "claude") {
        return {
            host: "claude",
            steps: [
                "Open Claude Desktop MCP settings.",
                "Set command: npx",
                "Set args: -y dance-of-tal",
                "Reload Claude Desktop and verify with: act_overview."
            ]
        };
    }
    if (targetHost === "openclaw") {
        return {
            host: "openclaw",
            steps: [
                "Run this MCP server via stdio command: npx -y dance-of-tal.",
                "Call build_openclaw_profile with selected Tal/Dance.",
                "Paste returned systemPrompt into your OpenClaw assistant profile."
            ]
        };
    }
    if (targetHost === "cursor") {
        return {
            host: "cursor",
            steps: [
                "Open Cursor MCP integration settings and add a local stdio server.",
                "Set command: npx",
                "Set args: -y dance-of-tal",
                "Reload tools and test with: list_tals."
            ]
        };
    }
    if (targetHost === "gpts") {
        return {
            host: "gpts",
            steps: [
                "For GPTs Knowledge mode, upload tals/dances/summary JSON files.",
                "Optionally use web endpoints: https://dance-of-tal.vercel.app/data/*.json",
                "Use recommended combo first, then lock style in system instructions."
            ]
        };
    }
    return {
        host: "other",
        steps: [
            "Connect any MCP host using stdio command: npx -y dance-of-tal.",
            "Verify tool visibility with: act_overview.",
            "Use dot switch and dot run to validate active behavior."
        ]
    };
};

export const buildGenericMcpConfigSnippet = (projectDir: string) =>
    JSON.stringify(
        {
            mcpServers: {
                "dance-of-tal": {
                    command: "npx",
                    args: ["-y", "dance-of-tal"],
                    env: {
                        DANCE_OF_TAL_PROJECT_DIR: projectDir
                    }
                }
            }
        },
        null,
        2
    );
