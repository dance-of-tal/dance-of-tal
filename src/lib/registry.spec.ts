import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPerformer, listLockedPerformerNames, lockPerformer } from "./registry.js";

describe("registry performer safety", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "dot-registry-"));
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("locks and reads a valid performer", async () => {
    await lockPerformer(cwd, "sprint", {
      tal: "tal/@acme/system-architect",
      dance: "dance/@acme/json-structure",
    } as any);

    const performer = await getPerformer(cwd, "sprint");
    expect(performer).not.toBeNull();
    expect(performer?.tal).toBe("tal/@acme/system-architect");
  });

  it("rejects unsafe performer names", async () => {
    await expect(
      lockPerformer(cwd, "../escape", {
        tal: "tal/@acme/system-architect",
        dance: "dance/@acme/json-structure",
      } as any)
    ).rejects.toThrow("Invalid performer name");

    await expect(getPerformer(cwd, "../../leak")).rejects.toThrow("Invalid performer name");
  });

  it("lists valid locked performers and skips malformed filenames", async () => {
    await lockPerformer(cwd, "incident", {
      tal: "tal/@acme/system-architect",
      dance: "dance/@acme/json-structure",
    } as any);

    const performersDir = path.join(cwd, ".dance-of-tal", "performer");
    await fs.mkdir(performersDir, { recursive: true });
    await fs.writeFile(path.join(performersDir, "bad name.json"), "{}", "utf-8");

    const result = await listLockedPerformerNames(cwd);
    expect(result.names).toEqual(["incident"]);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]?.file).toBe("bad name.json");
  });
});
