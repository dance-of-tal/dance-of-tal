/**
 * Antigravity Stage Adapter
 *
 * Parses skills from the combo's dance rules and writes each as
 * an independent workflow file at `.agents/workflows/<skill-name>.md`.
 *
 * Antigravity reads these files automatically.
 */

import fs from "fs/promises";
import path from "path";
import { Skill } from "./skills-parser.js";

const WORKFLOWS_DIR = ".agents/workflows";

/**
 * Write skills as Antigravity workflow markdown files.
 */
export async function applyAntigravityStage(
    cwd: string,
    skills: Skill[]
): Promise<string[]> {
    if (skills.length === 0) return [];

    const workflowsDir = path.join(cwd, WORKFLOWS_DIR);
    await fs.mkdir(workflowsDir, { recursive: true });

    const written: string[] = [];

    for (const skill of skills) {
        const filename = `${toKebabCase(skill.name)}.md`;
        const filePath = path.join(workflowsDir, filename);

        const content = [
            "---",
            `description: ${skill.description}`,
            "---",
            "",
            skill.instructions,
            "",
        ].join("\n");

        await fs.writeFile(filePath, content, "utf-8");
        written.push(path.relative(cwd, filePath));
    }

    return written;
}

function toKebabCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
}
