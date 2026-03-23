/**
 * dot auth — GitHub OAuth PKCE login + auth file I/O
 *
 * Used by both the `dot` CLI and the Studio server.
 * Auth state is persisted to `~/.dance-of-tal/auth.json`.
 */

import fs from "fs/promises";
import path from "path";
import http from "http";
import crypto from "crypto";
import open from "open";
import { getGlobalDotDir } from "./registry.js";

// ── Constants ─────────────────────────────────────────────────────────────

const SUPABASE_URL =
    process.env.DOT_SUPABASE_URL ||
    "https://qbildcrfjencoqkngyfw.supabase.co";

// The anonymous key is intentionally public (client-side Supabase auth)
const SUPABASE_ANON_KEY =
    process.env.DOT_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiaWxkY3JmamVuY29xa25neWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjE5MzYsImV4cCI6MjA4NzgzNzkzNn0.9aI9FU-j20w3UIG7BuVtmpAPh3qClz7xTNXjcq7ofNQ";

const AUTH_CALLBACK_PORT = 4242;
const AUTH_REDIRECT_URI = `http://localhost:${AUTH_CALLBACK_PORT}/callback`;
const LOGIN_TIMEOUT_MS = 180_000;

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuthUser {
    token: string;
    username: string;
}

export type LoginResult =
    | { started: true; alreadyRunning: false; alreadyAuthenticated: false; authUrl: string; browserOpened: boolean }
    | { started: false; alreadyRunning: true; alreadyAuthenticated: false; authUrl: string; browserOpened: false }
    | { started: false; alreadyRunning: false; alreadyAuthenticated: true; username: string };

// ── Auth file I/O ─────────────────────────────────────────────────────────

function getAuthFilePath(): string {
    return path.join(getGlobalDotDir(), "auth.json");
}

/**
 * Read the current auth user from disk.
 * Returns null if not logged in or the token is invalid.
 */
export async function readAuthUser(): Promise<AuthUser | null> {
    try {
        const raw = await fs.readFile(getAuthFilePath(), "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed?.token || !parsed?.username) return null;
        return { token: String(parsed.token), username: String(parsed.username) };
    } catch {
        return null;
    }
}

/**
 * Persist a token + username to `~/.dance-of-tal/auth.json`.
 */
export async function saveAuthToken(token: string, username: string): Promise<void> {
    const authFile = getAuthFilePath();
    await fs.mkdir(path.dirname(authFile), { recursive: true });
    await fs.writeFile(authFile, JSON.stringify({ token, username }, null, 2), "utf-8");
}

/**
 * Remove `auth.json`, effectively logging the user out.
 * Safe to call even if the file does not exist.
 */
export async function clearAuthUser(): Promise<void> {
    try {
        await fs.unlink(getAuthFilePath());
    } catch (err: unknown) {
        if (!(err instanceof Error) || !("code" in err) || (err as NodeJS.ErrnoException).code !== "ENOENT") {
            throw err;
        }
    }
}

// ── PKCE helpers ──────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// ── Login state (singleton — only one login in flight at a time) ──────────

type LoginState = {
    server: http.Server;
    authUrl: string;
    timeout: NodeJS.Timeout;
};

let loginState: LoginState | null = null;

function clearLoginState(): void {
    if (!loginState) return;
    clearTimeout(loginState.timeout);
    loginState.server.close();
    loginState = null;
}

/**
 * Try to release a stale login port (for when a previous login server
 * was not shut down cleanly).
 */
async function releaseStaleLoginPort(): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1_500);
    try {
        await fetch(AUTH_REDIRECT_URI, {
            method: "GET",
            signal: controller.signal,
        }).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
        clearTimeout(timer);
    }
}

async function listenOnLoginPort(server: http.Server): Promise<void> {
    const tryListen = () =>
        new Promise<void>((resolve, reject) => {
            const onError = (err: Error & { code?: string }) => {
                server.off("listening", onListening);
                reject(err);
            };
            const onListening = () => {
                server.off("error", onError);
                resolve();
            };
            server.once("error", onError);
            server.once("listening", onListening);
            server.listen(AUTH_CALLBACK_PORT);
        });

    try {
        await tryListen();
    } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code !== "EADDRINUSE") throw err;

        // Port occupied — try to evict stale server first
        await releaseStaleLoginPort();
        try {
            await tryListen();
        } catch (retryErr: unknown) {
            const retryNodeErr = retryErr as NodeJS.ErrnoException;
            if (retryNodeErr.code === "EADDRINUSE") {
                throw new Error(
                    `Port ${AUTH_CALLBACK_PORT} is already in use by another process. ` +
                    `Finish or close the other DOT login flow first.`
                );
            }
            throw retryErr;
        }
    }
}

/**
 * Start a GitHub OAuth PKCE login flow.
 *
 * - Opens the user's browser to the GitHub OAuth page.
 * - Spins up a local HTTP server on port 4242 for the callback.
 * - Saves token + username to `~/.dance-of-tal/auth.json` on success.
 * - Times out after 3 minutes.
 *
 * Returns immediately with a `LoginResult` describing what was started;
 * the token is written asynchronously once the browser callback completes.
 */
export async function startLogin(): Promise<LoginResult> {
    const existing = await readAuthUser();
    if (existing) {
        return { started: false, alreadyRunning: false, alreadyAuthenticated: true, username: existing.username };
    }

    if (loginState) {
        return { started: false, alreadyRunning: true, alreadyAuthenticated: false, authUrl: loginState.authUrl, browserOpened: false };
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const authUrl =
        `${SUPABASE_URL}/auth/v1/authorize` +
        `?provider=github` +
        `&redirect_to=${encodeURIComponent(AUTH_REDIRECT_URI)}` +
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=s256`;

    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url || "/", `http://localhost:${AUTH_CALLBACK_PORT}`);
            if (url.pathname !== "/callback") {
                res.writeHead(404).end("Not Found");
                return;
            }

            const code = url.searchParams.get("code");
            if (!code) {
                res.writeHead(400, { "Content-Type": "text/html" });
                res.end(
                    "<h2 style='color:red;text-align:center;font-family:sans-serif;margin-top:50px'>" +
                    "Authentication failed: No code received. You can close this window.</h2>"
                );
                clearLoginState();
                return;
            }

            res.writeHead(200, { "Content-Type": "text/html" });
            res.write("<h2 style='font-family:sans-serif;text-align:center;margin-top:50px'>Completing authentication… Please wait.</h2>");

            try {
                const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
                    body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }),
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = await tokenRes.json() as any;
                if (!tokenRes.ok || !data.access_token) {
                    throw new Error(data.error_description || data.msg || "Failed to exchange token");
                }

                const username =
                    data.user?.user_metadata?.preferred_username ||
                    data.user?.user_metadata?.user_name;
                if (!username) {
                    throw new Error("Could not determine GitHub username from token.");
                }

                await saveAuthToken(data.access_token, username);
                res.end(`<script>
                    document.body.innerHTML="<h2 style='color:green;font-family:sans-serif;text-align:center;margin-top:50px'>Authentication Successful! You can safely close this window.</h2>";
                    setTimeout(()=>window.close(),3000);
                </script>`);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                res.end(`<script>
                    document.body.innerHTML="<h2 style='color:red;font-family:sans-serif;text-align:center;margin-top:50px'>Authentication Failed. ${msg}</h2>";
                </script>`);
            } finally {
                clearLoginState();
            }
        } catch {
            try { res.writeHead(500).end("Server Error"); } catch { /* ignore */ }
            clearLoginState();
        }
    });

    await listenOnLoginPort(server);

    loginState = {
        server,
        authUrl,
        timeout: setTimeout(() => clearLoginState(), LOGIN_TIMEOUT_MS),
    };

    let browserOpened = true;
    try {
        await open(authUrl);
    } catch {
        browserOpened = false;
    }

    return { started: true, alreadyRunning: false, alreadyAuthenticated: false, authUrl, browserOpened };
}
