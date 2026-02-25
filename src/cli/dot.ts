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

const program = new Command();

program
  .name("dot")
  .description("Dance of Tal V2 - Type-Safe AI Behavior Engine")
  .version("2.0.0");

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
  .description("Install a Vibe, Tal, Dance, Act, or Stage (e.g. dot install tal/@monarchjuno/strategy-chief)")
  .action(async (pkg: string) => {
    try {
      await runInstall(pkg);
    } catch (e: any) {
      console.error(ui.error(e.message));
      process.exit(1);
    }
  });

program
  .command("switch <vibeName>")
  .description("Switch the active Vibe for the current project")
  .action(async (vibeName: string) => {
    try {
      await runSwitch(vibeName);
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

program.parse(process.argv);
