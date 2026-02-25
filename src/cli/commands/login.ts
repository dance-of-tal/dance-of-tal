import { Command } from "commander";
import { ui } from "../utils/ui.js";
import fs from "fs/promises";
import path from "path";
import os from "os";
import open from "open";

// Registry endpoint URL (Can be overridden via env for testing)
const REGISTRY_URL = process.env.DOT_REGISTRY_URL || "https://registry.dance-of-tal-v2.workers.dev"; // Fallback demo registry url

function getAuthFilePath() {
    const dotGlobalDir = path.join(os.homedir(), ".dance-of-tal");
    return path.join(dotGlobalDir, "auth.json");
}

export async function saveAuthToken(token: string, username: string) {
    const authFile = getAuthFilePath();
    const dir = path.dirname(authFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(authFile, JSON.stringify({ token, username }, null, 2), "utf-8");
}

export async function getAuthToken(): Promise<string | null> {
    try {
        const raw = await fs.readFile(getAuthFilePath(), "utf-8");
        return JSON.parse(raw).token;
    } catch {
        return null;
    }
}

/** Returns { token, username } or null if not logged in. */
export async function getAuthUser(): Promise<{ token: string; username: string } | null> {
    try {
        const raw = await fs.readFile(getAuthFilePath(), "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed.token || !parsed.username) return null;
        return { token: parsed.token, username: parsed.username };
    } catch {
        return null;
    }
}

async function pollForToken(deviceCode: string, intervalSeconds: number): Promise<string> {
    const pollUrl = `${REGISTRY_URL}/auth/device/poll`;
    let currentInterval = intervalSeconds;

    while (true) {
        // Wait for the prescribed interval before polling
        await new Promise(resolve => setTimeout(resolve, currentInterval * 1000));

        try {
            const req = await fetch(pollUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ device_code: deviceCode })
            });
            const data: any = await req.json();

            if (data.access_token) {
                return data.access_token;
            } else if (data.error) {
                if (data.error === 'authorization_pending') {
                    // Keep waiting
                    continue;
                } else if (data.error === 'slow_down') {
                    // GitHub requested we slow down
                    currentInterval += 5;
                    continue;
                } else {
                    throw new Error(data.error_description || data.error);
                }
            }
        } catch (e: any) {
            // If it's a fetch error, we might just sleep and retry, but let's throw for now
            throw new Error(`Polling failed: ${e.message}`);
        }
    }
}

export const loginCmd = new Command("login")
    .description("Login to Dance of Tal Registry using GitHub (Device Flow)")
    .action(async () => {
        console.log(ui.title("Authenticating with GitHub"));

        try {
            // 1. Request device code
            const codeUrl = `${REGISTRY_URL}/auth/device/code`;
            const codeReq = await fetch(codeUrl, { method: "POST" });

            if (!codeReq.ok) {
                throw new Error(`Registry error: ${codeReq.statusText}`);
            }

            const codeData: any = await codeReq.json();

            if (codeData.error) {
                throw new Error(codeData.error_description || codeData.error);
            }

            console.log(ui.success(`Please complete authentication in your browser.`));
            console.log(ui.dim(`Your One-Time Code is: `) + ui.highlight(codeData.user_code));
            console.log(ui.dim(`\nIf your browser doesn't open automatically, navigate to:`));
            console.log(ui.dim(codeData.verification_uri));

            // Auto-open browser
            await open(codeData.verification_uri);

            // 2. Poll for token
            console.log("\nWaiting for authorization...");
            const token = await pollForToken(codeData.device_code, codeData.interval || 5);


            // Attempt to fetch their username just to verify and greet them
            const userReq = await fetch("https://api.github.com/user", {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "User-Agent": "Dance-of-Tal-CLI"
                }
            });

            const userData: any = await userReq.json();

            if (!userReq.ok) {
                throw new Error(`Failed to fetch GitHub user info: ${userData.message || userReq.statusText}`);
            }

            if (!userData || !userData.login) {
                throw new Error("Invalid GitHub user data received.");
            }

            // 3. Authenticated successfully — save token AND username
            await saveAuthToken(token, userData.login);

            console.log(ui.success(`\nAuthentication successful! You are logged in as @${userData.login}.`));
            console.log(ui.dim("You can now publish your V2 Tals, Dances, and Combos."));

        } catch (err: any) {
            console.error(ui.error(`Login failed: ${err.message}`));
            process.exit(1);
        }
    });
