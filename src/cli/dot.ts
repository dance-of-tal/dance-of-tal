#!/usr/bin/env node
import { Command } from "commander";
import { ui } from "./utils/ui.js";

import { runInit } from "./commands/init.js";
import { runInstall } from "./commands/install.js";
import { runSwitch } from "./commands/switch.js";
import { lockCmd } from "./commands/lock.js";
import { compileCmd } from "./commands/compile.js";
import { runCmd } from "./commands/run.js";
import { publishCmd } from "./commands/publish.js";
import { loginCmd } from "./commands/login.js";
import { agentsCmd } from "./commands/agents.js";
import { searchCmd } from "./commands/search.js";
import { listCmd } from "./commands/list.js";
import { useCmd } from "./commands/use.js";
import { createCmd } from "./commands/create.js";
import { launchCmd } from "./commands/launch.js";

const program = new Command();

program
  .name("dot")
  .description("Dance of Tal - Type-Safe AI Behavior Engine")
  .version("2.0.3");

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
  .action(async (pkg: string) => {
    try {
      await runInstall(pkg);
    } catch (e: any) {
      console.error(ui.error(e.message));
      process.exit(1);
    }
  });

program
  .command("switch <comboName>")
  .description("Switch the active Combo for the current project")
  .action(async (comboName: string) => {
    try {
      await runSwitch(comboName);
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
program.addCommand(useCmd);
program.addCommand(createCmd);
program.addCommand(launchCmd);

program.parse(process.argv);
