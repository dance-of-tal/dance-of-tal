import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCombo, listLockedComboNames, lockCombo } from "./registry.js";

describe("registry combo safety", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "dot-registry-"));
  });

  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("locks and reads a valid combo", async () => {
    await lockCombo(cwd, "sprint", {
      tal: "tal/@dot-presets/system-architect",
      dance: "dance/@dot-presets/json-structure",
    });

    const combo = await getCombo(cwd, "sprint");
    expect(combo).not.toBeNull();
    expect(combo?.tal).toBe("tal/@dot-presets/system-architect");
  });

  it("rejects unsafe combo names", async () => {
    await expect(
      lockCombo(cwd, "../escape", {
        tal: "tal/@dot-presets/system-architect",
        dance: "dance/@dot-presets/json-structure",
      })
    ).rejects.toThrow("Invalid combo name");

    await expect(getCombo(cwd, "../../leak")).rejects.toThrow("Invalid combo name");
  });

  it("lists valid locked combos and skips malformed filenames", async () => {
    await lockCombo(cwd, "incident", {
      tal: "tal/@dot-presets/system-architect",
      dance: "dance/@dot-presets/json-structure",
    });

    const combosDir = path.join(cwd, ".dance-of-tal", "combo");
    await fs.mkdir(combosDir, { recursive: true });
    await fs.writeFile(path.join(combosDir, "bad name.json"), "{}", "utf-8");

    const result = await listLockedComboNames(cwd);
    expect(result.names).toEqual(["incident"]);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0]?.file).toBe("bad name.json");
  });
});
