/**
 * Skills Parser
 *
 * Extracts skill definitions from a Dance's `rules` markdown text.
 *
 * Convention:
 *   ## Skills
 *   ### <skill-name>
 *   <description line>
 *   <rest = instructions>
 */

export interface Skill {
    name: string;
    description: string;
    instructions: string;
}

/**
 * Parse `## Skills` block from a dance's rules text.
 * Returns an empty array if no skills section is found.
 */
export function parseSkills(rules: string): Skill[] {
    // Find the ## Skills section
    const skillsSectionMatch = rules.match(
        /^## Skills\s*$/m
    );
    if (!skillsSectionMatch || skillsSectionMatch.index === undefined) {
        return [];
    }

    // Extract everything after "## Skills" until the next ## heading or end of string
    const afterSkills = rules.slice(
        skillsSectionMatch.index + skillsSectionMatch[0].length
    );
    const nextH2 = afterSkills.search(/^## (?!#)/m);
    const skillsBlock =
        nextH2 === -1 ? afterSkills : afterSkills.slice(0, nextH2);

    // Split by ### headings to get individual skills
    const skillChunks = skillsBlock.split(/^### /m).filter((s) => s.trim());

    return skillChunks.map((chunk) => {
        const lines = chunk.split("\n");
        const name = lines[0].trim();
        const bodyLines = lines.slice(1);

        // First non-empty line after the heading = description
        const descIdx = bodyLines.findIndex((l) => l.trim().length > 0);
        const description =
            descIdx >= 0 ? bodyLines[descIdx].trim() : "";

        // Everything after the description = instructions
        const instructionLines =
            descIdx >= 0 ? bodyLines.slice(descIdx + 1) : [];

        // Trim leading/trailing empty lines from instructions
        const instructions = instructionLines
            .join("\n")
            .trim();

        return { name, description, instructions };
    });
}
