#!/usr/bin/env node
import { Command } from "commander";
import { ui } from "./utils/ui.js";

import { runInit } from "./commands/init.js";
import { runInstall } from "./commands/install.js";

import { publishCmd } from "./commands/publish.js";
import { loginCmd } from "./commands/login.js";
import { agentsCmd } from "./commands/agents.js";
import { searchCmd } from "./commands/search.js";
import { listCmd } from "./commands/list.js";
import { createCmd } from "./commands/create.js";
import { checkForUpdates } from "./utils/update-check.js";


const program = new Command();

program
  .name("dot")
  .description("Dance of Tal — Agent Manager for Agentic AI")
  .version("3.2.0")
  .hook("postAction", async () => {
    await checkForUpdates();
  });

program
  .command("init")
  .description("Initialize .dance-of-tal setup for vibe coding in your project")
  .action(async () => {
    try {
      await runInit();
    } catch (e: any) {
      console.error(ui.error(e.message));
      process.exit(1);
    }
  });

program
  .command("install <package>")
  .description("Install a Tal, Dance, Act, or Performer (e.g. dot install performer/@acme/pr-review)")
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
program.addCommand(agentsCmd);
program.addCommand(searchCmd);
program.addCommand(listCmd);
program.addCommand(createCmd);


program.parse(process.argv);
