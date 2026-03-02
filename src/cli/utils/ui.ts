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
        ["dot install <urn>", "Install tal|dance|act|combo asset from registry"],
        ["dot use combo/@author/name", "Install + lock + switch combo in one step"],
        ["dot lock --name <n> --tal ... --dance ...", "Create local combo lockfile"],
        ["dot switch <comboName>", "Switch active combo"],
        ["dot compile <comboName>", "Validate combo asset existence and URN format"],
        ["dot run <comboName> --task \"...\"", "Compile and print system prompt payload"],
        ["dot launch <urn> --editor cursor|windsurf|code", "Install and open IDE with active combo"],
        ["dot create --kind tal|dance|act --name <slug>", "Create local asset template"],
        ["dot publish --kind ... --name ...", "Publish local asset/combo to registry"],
        ["dot search <keyword>", "Search registry packages"],
        ["dot list [--kind ...] [--mine]", "List registry packages"],
        ["dot agents set|list|remove", "Manage role -> combo mappings in agents.json"],
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
            "  Build and activate reproducible Tal + Dance combos for MCP/CLI workflows.",
            "",
            ui.section("Quick Start"),
            `  1) ${ui.command("dot init")}`,
            `  2) ${ui.command("dot use combo/@acme/pr-review --name pr-review")}`,
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
            "  Active combo: .dance-of-tal/combo.config.json",
            "  Combos:       .dance-of-tal/combo/<name>.json",
            "  Runs:         .dance-of-tal/runs/<runId>/state.json",
            ""
        ].join("\n")
    );
};
