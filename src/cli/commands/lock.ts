import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { lockPerformer } from "../../lib/registry.js";
import { Performer } from "../../data/types.js";

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
    .description("Lock a Type-Safe Dance of Tal performer for this project")
    .requiredOption("--name <performerName>", "The name for this performer")
    .option("--tal <talUrn>", "Tal URN, e.g. tal/@acme/system-architect (or shorthand @acme/system-architect)")
    .option("--dance <danceUrns>", "Dance URN(s) — single or comma-separated for layering, e.g. dance/@base/ts,dance/@team/tdd")
    .option("--act <actUrn>", "Act URN for workflow state machine, e.g. act/@acme/incident-response")
    .option("--model <modelId>", "Optional Model ID — e.g. provider/model-name")
    .action(async (options) => {
        console.log(ui.title("Locking Performer"));

        try {
            if (!options.tal && !options.dance && !options.act) {
                throw new Error(
                    "At least one of --tal, --dance, or --act must be provided.\n" +
                    "  Examples:\n" +
                    "    dot lock --tal tal/@acme/persona --name my-performer\n" +
                    "    dot lock --dance dance/@acme/rules --name my-performer\n" +
                    "    dot lock --tal tal/@acme/persona --dance dance/@acme/rules --name my-performer\n" +
                    "    dot lock --act act/@acme/workflow --name my-performer"
                );
            }

            const talUrn = options.tal ? normaliseUrn(options.tal, "tal") : undefined;
            const actUrn = options.act ? normaliseUrn(options.act, "act") : undefined;

            // Dance: comma-separated for layering, single URN for simple case
            let danceUrns: string[] | undefined;
            if (options.dance) {
                const rawDances = (options.dance as string).split(",").map((s: string) => s.trim()).filter(Boolean);
                danceUrns = rawDances.map((d: string) => normaliseUrn(d, "dance"));
            }

            const performer = {
                ...(talUrn ? { tal: talUrn } : {}),
                ...(danceUrns ? { dance: danceUrns.length === 1 ? danceUrns[0] : danceUrns } : {}),
                ...(actUrn ? { act: actUrn } : {}),
                ...(options.model ? { model: options.model } : {}),
            } as Performer;

            await lockPerformer(process.cwd(), options.name, performer);

            console.log(ui.success(`Successfully locked performer: ${options.name}`));
            console.log(ui.dim(JSON.stringify(performer, null, 2)));
            console.log(ui.dim("\nTo compile and verify this performer, run:"));
            console.log(ui.dim(`  dot compile ${options.name}`));
        } catch (err: any) {
            console.error(ui.error(`Failed to lock performer: ${err.message}`));
            process.exit(1);
        }
    });
