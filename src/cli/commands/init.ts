import fs from "fs";
import path from "path";
import { ui } from "../utils/ui.js";
import { initRegistry } from "../../lib/registry.js";

export async function runInit() {
    console.log(ui.title("Initializing Dance of Tal"));

    try {
        await initRegistry(process.cwd());
        console.log(ui.success("Created workspace directory structure:"));
        console.log(ui.dim("  .dance-of-tal/assets/<kind>/@author/<slug>.json"));
        console.log(ui.dim("  .dance-of-tal/drafts/<kind>/"));
    } catch (err: any) {
        console.log(ui.error(`Failed to initialize: ${err.message}`));
        return;
    }

    console.log(ui.success("\nDOT setup complete!"));
    console.log(ui.dim("    Next: dot install performer/@<author>/<name>"));
}

/**
 * Scaffolds a new Dance skill directory with SKILL.md template.
 */
export function scaffoldDanceSkill(name: string): void {
    const skillDir = path.join(process.cwd(), name);

    if (fs.existsSync(skillDir)) {
        console.error(ui.error(`Directory '${name}' already exists.`));
        process.exit(1);
    }

    fs.mkdirSync(skillDir, { recursive: true });
    fs.mkdirSync(path.join(skillDir, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });

    const skillMd = [
        "---",
        `name: ${name}`,
        "description: >",
        "  Describe what this skill does and when to use it.",
        "license: MIT",
        "compatibility: No special requirements",
        "metadata:",
        `  author: your-name`,
        '  version: "1.0"',
        "---",
        "",
        `# ${name}`,
        "",
        "## When to Use",
        "Describe the trigger conditions for this skill.",
        "",
        "## Steps",
        "1. First step",
        "2. Second step",
        "",
        "## Output Format",
        "Describe the expected output structure.",
    ].join("\n");

    fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillMd);
    fs.writeFileSync(
        path.join(skillDir, "scripts", ".gitkeep"),
        "# Place executable scripts here\n"
    );
    fs.writeFileSync(
        path.join(skillDir, "references", ".gitkeep"),
        "# Place reference documents here\n"
    );

    console.log(ui.success(`\n✔ Created Dance skill scaffold: ${name}/`));
    console.log(ui.dim(`  ${name}/SKILL.md`));
    console.log(ui.dim(`  ${name}/scripts/`));
    console.log(ui.dim(`  ${name}/references/`));
    console.log(ui.dim(`\n  Edit SKILL.md, then push to GitHub and run 'dot add'.`));
}

