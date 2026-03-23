import { Command } from "commander";
import { ui } from "../utils/ui.js";
import { readAuthUser, saveAuthToken, clearAuthUser, startLogin } from "../../lib/auth.js";

// Re-export for downstream consumers within the CLI (e.g. publish.ts)
export { readAuthUser as getAuthUser, saveAuthToken };

export const loginCmd = new Command("login")
    .description("Login to Dance of Tal Registry via GitHub OAuth")
    .action(async () => {
        console.log(ui.title("Authenticating with Dance of Tal Registry"));
        console.log(ui.dim("Using GitHub OAuth…"));
        console.log(
            ui.dim("\n  By logging in, you agree to the Dance of Tal Terms of Service:") +
            "\n  " + ui.highlight("https://danceoftal.com/tos") + "\n"
        );

        try {
            const result = await startLogin();

            if (result.alreadyAuthenticated) {
                console.log(ui.success(`✔ Already logged in as @${result.username}.`));
                return;
            }

            if (result.alreadyRunning) {
                console.log(ui.dim("  Login already in progress. Open this URL in your browser:"));
                console.log(ui.highlight(result.authUrl));
                return;
            }

            // result.started === true
            if (!result.browserOpened) {
                console.log(ui.dim("  Could not open browser. Open this URL manually:"));
            } else {
                console.log(ui.dim("  Browser opened. Complete the GitHub OAuth flow to continue."));
            }
            console.log(ui.highlight(result.authUrl));
            console.log(ui.dim("\n  Waiting for authorization… (timeout: 3 min)"));

            // Wait for the callback server to finish (it will close on its own)
            await new Promise<void>((resolve) => {
                // Poll every 500ms until auth.json appears
                const poll = setInterval(async () => {
                    const user = await readAuthUser();
                    if (user) {
                        clearInterval(poll);
                        console.log(ui.success(`\n✔ Logged in as @${user.username}.`));
                        resolve();
                    }
                }, 500);

                // Honour the same 3-min timeout
                setTimeout(() => {
                    clearInterval(poll);
                    console.error(ui.error("Login timed out. Please try again."));
                    resolve();
                }, 180_000);
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(ui.error(`Login failed: ${msg}`));
            process.exit(1);
        }
    });

export const logoutCmd = new Command("logout")
    .description("Logout from Dance of Tal Registry (removes saved credentials)")
    .action(async () => {
        try {
            const user = await readAuthUser();
            if (!user) {
                console.log(ui.dim("You are not currently logged in."));
                return;
            }
            await clearAuthUser();
            console.log(ui.success(`✔ Logged out (@${user.username}). Credentials removed.`));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(ui.error(`Logout failed: ${msg}`));
            process.exit(1);
        }
    });
