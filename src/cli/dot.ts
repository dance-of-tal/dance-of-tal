#!/usr/bin/env node
import { Command } from "commander";
import { ui } from "./utils/ui.js";

import { runInit } from "./commands/init.js";
import { runInstall } from "./commands/install.js";
import { lockCmd } from "./commands/lock.js";
import { compileCmd } from "./commands/compile.js";
import { runCmd } from "./commands/run.js";
import { publishCmd } from "./commands/publish.js";
import { loginCmd } from "./commands/login.js";
import { agentsCmd } from "./commands/agents.js";
import { searchCmd } from "./commands/search.js";
import { listCmd } from "./commands/list.js";
import { createCmd } from "./commands/create.js";
import { checkForUpdates } from "./utils/update-check.js";
import { launchCmd } from "./commands/launch.js";

const program = new Command();

program
  .name("dot")
  .description("Dance of Tal — Agent Manager for Agentic AI")
  .version("2.2.0")
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
  .description("Install a Tal, Dance, Act, or Combo (e.g. dot install combo/@acme/pr-review)")
  .option("--no-lock", "Skip auto-locking when installing a combo")
  .option("--stage <environment>", "Generate host-native files: antigravity, cursor, windsurf, codex, openclaw, opencode, claude")
  .action(async (pkg: string, options) => {
    try {
      await runInstall(pkg, options);
    } catch (e: any) {
      console.error(ui.error(e.message));
      process.exit(1);
    }
  });

program.addCommand(lockCmd);
program.addCommand(compileCmd);
program.addCommand(runCmd);
program.addCommand(publishCmd);
program.addCommand(loginCmd);
program.addCommand(agentsCmd);
program.addCommand(searchCmd);
program.addCommand(listCmd);
program.addCommand(createCmd);
program.addCommand(launchCmd);

program.parse(process.argv);
