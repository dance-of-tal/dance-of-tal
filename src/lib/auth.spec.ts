import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAuthUser, readAuthUser, saveAuthToken } from "./auth.js";

function makeJwt(exp: number): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ exp, sub: "user-1" })}.signature`;
}

describe("auth storage", () => {
  const originalHome = process.env.DANCE_OF_TAL_HOME;
  let tempHome: string;

  beforeEach(async () => {
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "dot-auth-"));
    process.env.DANCE_OF_TAL_HOME = tempHome;
  });

  afterEach(async () => {
    await clearAuthUser();

    if (originalHome === undefined) {
      delete process.env.DANCE_OF_TAL_HOME;
    } else {
      process.env.DANCE_OF_TAL_HOME = originalHome;
    }

    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it("returns the saved user when the JWT is still valid", async () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) + 3600);

    await saveAuthToken(token, "acme");

    await expect(readAuthUser()).resolves.toEqual({
      token,
      username: "acme",
    });
  });

  it("treats expired JWT auth files as logged out and clears them", async () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) - 60);

    await saveAuthToken(token, "acme");

    await expect(readAuthUser()).resolves.toBeNull();
    await expect(readAuthUser()).resolves.toBeNull();
  });

  it("supports stored expiry metadata for non-JWT tokens", async () => {
    const token = "opaque-access-token";

    await saveAuthToken(token, "acme", Math.floor(Date.now() / 1000) + 3600);

    await expect(readAuthUser()).resolves.toEqual({
      token,
      username: "acme",
    });
  });
});
