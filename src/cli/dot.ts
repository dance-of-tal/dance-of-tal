#!/usr/bin/env node
import { Command } from "commander";
import { ui } from "./utils/ui.js";

import { runInit, scaffoldDanceSkill } from "./commands/init.js";
import { runInstall } from "./commands/install.js";

import { publishCmd } from "./commands/publish.js";
import { loginCmd, logoutCmd } from "./commands/login.js";
import { searchCmd } from "./commands/search.js";
import { listCmd } from "./commands/list.js";
import { createCmd } from "./commands/create.js";
import { addCmd } from "./commands/add.js";
import { checkCmd } from "./commands/check.js";
import { updateCmd } from "./commands/update.js";
import { checkForUpdates } from "./utils/update-check.js";


const program = new Command();

program
  .name("dot")
  .description("Dance of Tal — Agent Manager for Agentic AI")
  .version("4.0.0")
  .hook("postAction", async () => {
    await checkForUpdates();
  });

program
  .command("init")
  .description("Initialize .dance-of-tal setup for vibe coding in your project")
  .argument("[type]", "init type: omit for project init, 'dance' for SKILL.md scaffolding")
  .option("--name <name>", "skill name (for 'dance' init)")
  .action(async (type: string | undefined, options: { name?: string }) => {
    try {
      if (type === "dance") {
        scaffoldDanceSkill(options.name || "my-skill");
      } else {
        await runInit();
      }
    } catch (e: any) {
      console.error(ui.error(e.message));
      process.exit(1);
    }
  });

program
  .command("install <package>")
  .description("Install a Tal, Dance, Act, or Performer (e.g. dot install performer/@acme/workflows/pr-review)")
  .option("-g, --global", "Install to global ~/.dance-of-tal instead of project-local")
  .action(async (pkg: string, options) => {
    try {
      await runInstall(pkg, options);
    } catch (e: any) {
      console.error(ui.error(e.message));
      process.exit(1);
    }
  });


program.addCommand(publishCmd);
program.addCommand(loginCmd);
program.addCommand(logoutCmd);
program.addCommand(searchCmd);
program.addCommand(listCmd);
program.addCommand(createCmd);
program.addCommand(addCmd);
program.addCommand(checkCmd);
program.addCommand(updateCmd);


program.parse(process.argv);
