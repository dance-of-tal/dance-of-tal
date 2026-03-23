import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { readSkillLock } from "../../lib/skill-lock.js";
import { checkAllUpdates } from "../../lib/sync.js";

export const checkCmd = new Command("check")
    .description("Check installed Dance skills for available updates")
    .action(async () => {
        console.log(ui.title("Checking for Updates"));

        try {
            const cwd = process.cwd();
            const lock = await readSkillLock(cwd);
            const urns = Object.keys(lock.skills);

            if (urns.length === 0) {
                console.log(ui.dim("\n  No Dance skills installed. Use 'dot add' to install."));
                return;
            }

            console.log(ui.dim(`\n  Checking ${urns.length} skill(s)...\n`));

            const results = await checkAllUpdates(lock.skills);

            const updatable = results.filter(r => r.hasUpdate);
            const errors = results.filter(r => r.error);
            const upToDate = results.filter(r => !r.hasUpdate && !r.error);

            if (upToDate.length > 0) {
                for (const r of upToDate) {
                    console.log(ui.dim(`  ✓ ${r.urn} — up to date`));
                }
            }

            if (updatable.length > 0) {
                console.log(ui.section("\n  Updates available:"));
                for (const r of updatable) {
                    console.log(`    ${ui.highlight(r.urn)} ${ui.dim(`(${r.sourceUrl})`)}`);
                }
                console.log(ui.dim(`\n  Run 'dot update' to apply updates.`));
            } else if (errors.length === 0) {
                console.log(ui.success("\n✔ All skills are up to date."));
            }

            if (errors.length > 0) {
                console.log(ui.warning("\n  Could not check:"));
                for (const r of errors) {
                    console.log(`    ${ui.dim(`${r.urn}: ${r.error}`)}`);
                }
            }

        } catch (err: any) {
            console.error(ui.error(`Check failed: ${err.message}`));
            process.exit(1);
        }
    });
