import { Command } from "commander";
import { ui } from "../utils/ui.js";
import fs from "fs/promises";
import path from "path";
import open from "open";
import http from "http";
import crypto from "crypto";

const SUPABASE_URL = process.env.DOT_SUPABASE_URL || "https://qbildcrfjencoqkngyfw.supabase.co";
// The ANON key is intentionally public to allow client-side Supabase communication
const SUPABASE_ANON_KEY = process.env.DOT_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaWxkY3JmamVuY29xa25neWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjE5MzYsImV4cCI6MjA4NzgzNzkzNn0.9aI9FU-j20w3UIG7BuVtmpAPh3qClz7xTNXjcq7ofNQ";

import { getGlobalDotDir } from "../../lib/registry.js";

function getAuthFilePath() {
    return path.join(getGlobalDotDir(), "auth.json");
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

function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export const loginCmd = new Command("login")
    .description("Login to Dance of Tal Registry via GitHub")
    .action(async () => {
        console.log(ui.title("Authenticating with Dance of Tal Registry"));
        console.log(ui.dim("Using GitHub OAuth...\n"));

        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        return new Promise<void>((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                try {
                    const baseUrl = `http://localhost:4242`;
                    const url = new URL(req.url || "/", baseUrl);

                    if (url.pathname === "/callback") {
                        const code = url.searchParams.get("code");

                        if (!code) {
                            res.writeHead(400, { "Content-Type": "text/html" });
                            res.end("<h2 style='color: red; text-align: center; font-family: sans-serif; margin-top: 50px;'>Authentication failed: No code received. You can close this window.</h2>");
                            server.close();
                            reject(new Error("No auth code received"));
                            return;
                        }

                        res.writeHead(200, { "Content-Type": "text/html" });
                        res.write("<h2 style='font-family: sans-serif; text-align: center; margin-top: 50px;'>Completing authentication... Please wait.</h2>");

                        try {
                            // Exchange the authorization code for a session token using PKCE
                            const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'apikey': SUPABASE_ANON_KEY
                                },
                                body: JSON.stringify({
                                    auth_code: code,
                                    code_verifier: codeVerifier
                                })
                            });

                            const data: any = await tokenRes.json();

                            if (!tokenRes.ok || !data.access_token) {
                                throw new Error(data.error_description || data.msg || "Failed to exchange token");
                            }

                            const accessToken = data.access_token;
                            const user = data.user;
                            const username = user?.user_metadata?.preferred_username || user?.user_metadata?.user_name;

                            if (!username) {
                                throw new Error("Could not determine GitHub username from token. Please try again.");
                            }

                            await saveAuthToken(accessToken, username);

                            console.log(ui.success(`\n✔ Authentication successful! You are logged in as @${username}.`));

                            res.end(`
                                <script>
                                    document.body.innerHTML = "<h2 style='color: green; font-family: sans-serif; text-align: center; margin-top: 50px;'>Authentication Successful! You can safely close this window.</h2>";
                                    setTimeout(() => window.close(), 3000);
                                </script>
                            `);
                            server.close();
                            resolve();
                        } catch (e: any) {
                            console.error(ui.error(`\nLogin failed during code exchange: ${e.message}`));
                            res.end(`
                                <script>
                                    document.body.innerHTML = "<h2 style='color: red; font-family: sans-serif; text-align: center; margin-top: 50px;'>Authentication Failed. Please try again.</h2>";
                                </script>
                            `);
                            server.close();
                            reject(e);
                        }
                    } else {
                        res.writeHead(404).end("Not Found");
                    }
                } catch (e) {
                    res.writeHead(500).end("Server Error");
                }
            });

            server.on('error', (e: any) => {
                if (e.code === 'EADDRINUSE') {
                    console.error(ui.error("Port 4242 is already in use. Cannot start login server."));
                    process.exit(1);
                }
            });

            server.listen(4242, async () => {
                const REDIRECT_URI = "http://localhost:4242/callback";
                const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(REDIRECT_URI)}&code_challenge=${codeChallenge}&code_challenge_method=s256`;

                console.log(ui.dim(`Opening browser to authenticate with GitHub...`));
                console.log(ui.dim(`If your browser doesn't open automatically, navigate to:`));
                console.log(ui.highlight(authUrl));
                console.log(ui.dim(`\nWaiting for authorization...`));

                await open(authUrl);
            });

            // Allow manual Ctrl+C
            process.on("SIGINT", () => {
                server.close();
                process.exit(1);
            });
        });
    });
