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
        ["dot create --kind tal|dance|performer|act --name <slug>", "Create local asset template"],
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
            `  2) ${ui.command("dot install performer/@acme/pr-review")}`,
            "",
            ui.section("Commands"),
            ...commandRows.map(([left, right]) => `  ${ui.command(pad(left))}${right}`),
            "",
            ui.section("Examples"),
            `  ${ui.command("dot install performer/@acme/sprint")}`,
            `  ${ui.command("dot install tal/@acme/system-architect")}`,
            "",
            ui.section("Project Config"),
            "  Performers:       .dance-of-tal/performer/<name>.json",
            ""
        ].join("\n")
    );
};
