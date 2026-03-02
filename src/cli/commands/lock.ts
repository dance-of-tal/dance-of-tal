import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { lockCombo, Combo } from "../../lib/registry.js";

const VALID_URN_RE = /^(tal|dance|act)\/@[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;

/**
 * Normalises a URN argument into the strict 3-part form:
 *   - "@author/name"         → "<prefix>/@author/name"
 *   - "<prefix>/@author/name" → used as-is
 *   - anything else           → throws with a helpful message
 */
function normaliseUrn(raw: string, prefix: "tal" | "dance" | "act"): string {
    // Already fully qualified, e.g. tal/@monarchjuno/system-architect
    if (VALID_URN_RE.test(raw)) {
        if (!raw.startsWith(`${prefix}/`)) {
            throw new Error(
                `URN kind mismatch: expected a '${prefix}' URN, got '${raw}'`
            );
        }
        return raw;
    }

    // Shorthand: @author/name  →  prefix/@author/name
    if (raw.startsWith("@") && raw.split("/").length === 2) {
        return `${prefix}/${raw}`;
    }

    throw new Error(
        `Invalid URN: '${raw}'\n` +
        `  Expected full URN:  ${prefix}/@<author>/<name>\n` +
        `  Or shorthand:       @<author>/<name>`
    );
}

export const lockCmd = new Command("lock")
    .description("Lock a Type-Safe Dance of Tal combo for this project")
    .requiredOption("--name <comboName>", "The name for this combo")
    .requiredOption("--tal <talUrn>", "Tal URN, e.g. tal/@acme/system-architect (or shorthand @acme/system-architect)")
    .requiredOption("--dance <danceUrns>", "Dance URN(s) — single or comma-separated for layering, e.g. dance/@base/ts,dance/@team/tdd")
    .option("--act <actUrn>", "Optional Act URN — e.g. act/@infra/hotfix-override")
    .action(async (options) => {
        console.log(ui.title("Locking Combo"));

        try {
            const talUrn = normaliseUrn(options.tal, "tal");

            // Dance: comma-separated for layering, single URN for simple case
            const rawDances = (options.dance as string).split(",").map((s: string) => s.trim()).filter(Boolean);
            const danceUrns = rawDances.map((d: string) => normaliseUrn(d, "dance"));

            const combo: Combo = {
                tal: talUrn,
                dance: danceUrns.length === 1 ? danceUrns[0] : danceUrns,
                act: options.act ? normaliseUrn(options.act, "act") : undefined,
            };

            await lockCombo(process.cwd(), options.name, combo);

            console.log(ui.success(`Successfully locked combo: ${options.name}`));
            console.log(ui.dim(JSON.stringify(combo, null, 2)));
            console.log(ui.dim("\nTo compile and verify this combo, run:"));
            console.log(ui.dim(`  dot compile ${options.name}`));
        } catch (err: any) {
            console.error(ui.error(`Failed to lock combo: ${err.message}`));
            process.exit(1);
        }
    });
