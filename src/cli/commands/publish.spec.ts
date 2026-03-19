import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assetFilePath, initRegistry } from "../../lib/registry.js";
import { loadPublishPayload, resolveDependencies, resolveTagsOption } from "./publish.js";

async function writeAsset(cwd: string, urn: string, payload: Record<string, unknown>) {
  const filePath = assetFilePath(cwd, urn);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

describe("publish helpers", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fs.mkdtemp(path.join(os.tmpdir(), "dot-publish-"));
    await initRegistry(cwd);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("loads performer assets from the authored namespace path", async () => {
    await writeAsset(cwd, "performer/@monarchjuno/smoke-performer", {
      $schema: "https://schemas.danceoftal.com/assets/performer.v1.json",
      kind: "performer",
      urn: "performer/@monarchjuno/smoke-performer",
      description: "Smoke performer",
      tags: ["review"],
      payload: {
        tal: "tal/@monarchjuno/reviewer",
      },
    });

    const payload = await loadPublishPayload(cwd, "performer", "smoke-performer", "monarchjuno");
    expect(payload.urn).toBe("performer/@monarchjuno/smoke-performer");
    expect(payload.tags).toEqual(["review"]);
  });

  it("resolves performer dependencies from authored assets instead of lockfiles", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } })
    );

    await writeAsset(cwd, "tal/@monarchjuno/reviewer-tal", {
      $schema: "https://schemas.danceoftal.com/assets/tal.v1.json",
      kind: "tal",
      urn: "tal/@monarchjuno/reviewer-tal",
      tags: ["tal"],
      payload: {
        content: "tal content",
      },
    });
    await writeAsset(cwd, "dance/@monarchjuno/reviewer-dance", {
      $schema: "https://schemas.danceoftal.com/assets/dance.v1.json",
      kind: "dance",
      urn: "dance/@monarchjuno/reviewer-dance",
      tags: ["dance"],
      payload: {
        content: "dance content",
      },
    });
    await writeAsset(cwd, "performer/@monarchjuno/reviewer", {
      $schema: "https://schemas.danceoftal.com/assets/performer.v1.json",
      kind: "performer",
      urn: "performer/@monarchjuno/reviewer",
      tags: ["performer"],
      payload: {
        tal: "tal/@monarchjuno/reviewer-tal",
        dances: ["dance/@monarchjuno/reviewer-dance"],
      },
    });

    const deps = await resolveDependencies(
      cwd,
      "act",
      {
        $schema: "https://schemas.danceoftal.com/assets/act.v1.json",
        kind: "act",
        urn: "act/@monarchjuno/smoke-act",
        description: "test act",
        tags: [],
        payload: {
          participants: [
            {
              id: "worker",
              performer: "performer/@monarchjuno/reviewer",
              activeDances: ["dance/@monarchjuno/reviewer-dance"],
            },
          ],
          relations: [],
        },
      },
      "monarchjuno"
    );

    expect(deps.filter((dep) => dep.status === "to_publish").map((dep) => dep.urn)).toEqual([
      "tal/@monarchjuno/reviewer-tal",
      "dance/@monarchjuno/reviewer-dance",
      "performer/@monarchjuno/reviewer",
    ]);
  });

  it("uses payload tags when no publish tags are provided", () => {
    expect(resolveTagsOption(undefined, { tags: ["review", "backend"] })).toEqual(["review", "backend"]);
    expect(resolveTagsOption("frontend, react ", { tags: ["ignored"] })).toEqual(["frontend", "react"]);
  });
});
