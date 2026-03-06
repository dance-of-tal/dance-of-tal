export const supportsColor = Boolean(process.stdout.isTTY && process.env.NO_COLOR !== "1");

export const color = (value: string, code: string) => (supportsColor ? `${code}${value}\u001b[0m` : value);

export const ui = {
    title: (value: string) => color(value, "\u001b[1;36m"),
    section: (value: string) => color(value, "\u001b[1;35m"),
    command: (value: string) => color(value, "\u001b[36m"),
    step: (value: string) => color(value, "\u001b[1;33m"),
    dim: (value: string) => color(value, "\u001b[2m"),
    success: (value: string) => color(value, "\u001b[1;32m"),
    warning: (value: string) => color(value, "\u001b[1;33m"),
    error: (value: string) => color(value, "\u001b[1;31m"),
    highlight: (value: string) => color(value, "\u001b[1;37m") // Bold white
};

export const printUsage = () => {
    const commandRows: Array<[string, string]> = [
        ["dot init", "Initialize .dance-of-tal workspace"],
        ["dot install <urn>", "Install tal|dance|act|performer asset from registry"],
        ["dot use performer/@author/name", "Install + lock + switch performer in one step"],
        ["dot lock --name <n> --tal ... --dance ...", "Create local performer lockfile"],
        ["dot switch <performerName>", "Switch active performer"],
        ["dot compile <performerName>", "Validate performer asset existence and URN format"],
        ["dot run <performerName> --task \"...\"", "Compile and print system prompt payload"],
        ["dot launch <urn> --editor cursor|windsurf|code|codex|openclaw|opencode|claude", "Install and open IDE with active performer"],
        ["dot create --kind tal|dance|act --name <slug>", "Create local asset template"],
        ["dot publish --kind ... --name ...", "Publish local asset/performer to registry"],
        ["dot search <keyword>", "Search registry packages"],
        ["dot list [--kind ...] [--mine]", "List registry packages"],
        ["dot agents set|list|remove", "Manage role -> performer mappings in agents.json"],
        ["dot login", "Authenticate with GitHub for publish operations"]
    ];

    const width = Math.max(...commandRows.map(([left]) => left.length)) + 2;
    const pad = (value: string) => value.padEnd(width, " ");

    console.log(
        [
            "",
            ui.title("Dance of Tal CLI"),
            ui.dim("================"),
            "",
            ui.section("Purpose"),
            "  Build and activate reproducible Tal + Dance performers for MCP/CLI workflows.",
            "",
            ui.section("Quick Start"),
            `  1) ${ui.command("dot init")}`,
            `  2) ${ui.command("dot use performer/@acme/pr-review --name pr-review")}`,
            `  3) ${ui.command('dot run pr-review --task "Review my API design"')}`,
            "",
            ui.section("Commands"),
            ...commandRows.map(([left, right]) => `  ${ui.command(pad(left))}${right}`),
            "",
            ui.section("Examples"),
            `  ${ui.command("dot install tal/@acme/system-architect")}`,
            `  ${ui.command("dot lock --name sprint --tal @acme/system-architect --dance @acme/pr-review-standard")}`,
            `  ${ui.command("dot switch sprint")}`,
            `  ${ui.command('dot run sprint --task "Implement OAuth callback endpoint"')}`,
            "",
            ui.section("Project Config"),
            "  Active performer: .dance-of-tal/performer.config.json",
            "  Performers:       .dance-of-tal/performer/<name>.json",
            "  Runs:         .dance-of-tal/runs/<runId>/state.json",
            ""
        ].join("\n")
    );
};
