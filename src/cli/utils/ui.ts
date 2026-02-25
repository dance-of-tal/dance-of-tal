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
        ["dot pick tal|dance [filters]", "Pick a Tal or Dance from presets/custom items"],
        ["dot lock --tal <slug> [--dance <slug>]", "Lock active Tal/Dance into current project"],
        ["dot deploy --stage gpts|mcp|openclaw|threads", "Build channel-ready package from active Tal/Dance"],
        ["dot init [--project ...]", "Step-by-step setup wizard for .dance-of-tal config"],
        ["dot init --tal ... [--dance ...] [--name ...] [--target ...]", "Non-interactive init + optional starting combo"],
        ["dot setup ...", "Alias of dot init"],
        ["dot list tal|dance [filters]", "Browse preset data (add --include-custom to include saved custom items)"],
        ["dot show tal|dance <slug>", "Inspect one Tal or Dance"],
        ["dot switch tal|dance|combo", "Switch active Tal/Dance/Combo with selection UX"],
        ["dot doctor [--project ...] [--target ...]", "Run host-connection diagnostics and setup hints"],
        ["dot current", "Show active mode and combo details"],
        ["dot prompt --mode combined|thinking|output", "Print active prompt block"],
        ["dot run --task \"...\"", "Build task-ready SYSTEM + USER package from active mode"],
        ["dot combo list|show|use|rename", "Manage saved combos in this project"],
        ["dot combo custom --name ...", "Generate custom Tal/Dance and save as combo"],
        ["dot channel list|show|connect|disconnect", "Manage per-project channel credentials in .dance-of-tal/channels.json"],
        ["dot clear", "Clear active combo"],
        ["dot config show|path", "Inspect config file location/content"]
    ];

    const comboRows: Array<[string, string]> = [
        ["Combo", "Tal + Dance"],
        ["Tal-only", "Tal thinking only (no Dance)"],
        ["Dance-only", "Dance style only (no Tal)"]
    ];

    const width = Math.max(...commandRows.map(([left]) => left.length), ...comboRows.map(([left]) => left.length)) + 2;
    const pad = (value: string) => value.padEnd(width, " ");

    console.log(
        [
            "",
            ui.title("Dance of Tal CLI"),
            ui.dim("================"),
            "",
            ui.section("Purpose"),
            "  Apply Tal (thinking) and Dance (output) to AI behavior per project.",
            "",
            ui.section("Quick Start"),
            `  1) ${ui.command("dot pick tal --query founder")}`,
            `  2) ${ui.command('dot lock --tal elon-musk-case-tal --dance boardroom-brief --name "Founder Combo"')}`,
            `  3) ${ui.command('dot deploy --stage mcp --task "Draft weekly board update"')}`,
            "",
            ui.section("Modes"),
            ...comboRows.map(([left, right]) => `  ${pad(left)}${right}`),
            "",
            ui.section("Flow"),
            "  Pick -> Lock -> Deploy",
            "",
            ui.section("Commands"),
            ...commandRows.map(([left, right]) => `  ${ui.command(pad(left))}${right}`),
            "",
            ui.section("Examples"),
            `  ${ui.command('dot init --tal elon-musk-case-tal --name "Thinking Start"')}`,
            `  ${ui.command('dot init --tal elon-musk-case-tal --dance boardroom-brief --target openclaw --no-interactive')}`,
            `  ${ui.command("dot doctor --target windsurf")}`,
            `  ${ui.command('dot lock --dance boardroom-brief --name "Output Only"')}`,
            `  ${ui.command("dot switch tal")}`,
            `  ${ui.command('dot combo custom --name "My Custom" --tal-only --input "first principles and constraints"')}`,
            `  ${ui.command('dot combo custom --name "Threads Voice" --dance-only --stage threads --example "Input => Output"')}`,
            `  ${ui.command('dot channel connect threads --token "<TOKEN>" --meta userId="<THREADS_USER_ID>"')}`,
            `  ${ui.command("dot channel connect threads   # token can come from .dance-of-tal/.env")}`,
            `  ${ui.command('dot deploy --stage threads --publish --text "Launching private beta now."')}`,
            `  ${ui.command("dot list dance --category Executive --query concise")}`,
            "",
            ui.section("Project Config"),
            "  Stored at: .dance-of-tal/config.json",
            "  Channel secrets: .dance-of-tal/channels.json",
            "  Init targets: windsurf | claude | openclaw | cursor | gpts | other",
            ""
        ].join("\n")
    );
};
