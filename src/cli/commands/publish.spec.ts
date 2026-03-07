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
      type: "performer/@monarchjuno/smoke-performer",
      tags: ["review"],
      tal: "tal/@monarchjuno/reviewer",
    });

    const payload = await loadPublishPayload(cwd, "performer", "smoke-performer", "monarchjuno");
    expect(payload.type).toBe("performer/@monarchjuno/smoke-performer");
    expect(payload.tags).toEqual(["review"]);
  });

  it("resolves performer dependencies from authored assets instead of lockfiles", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } })
    );

    await writeAsset(cwd, "tal/@monarchjuno/reviewer-tal", {
      type: "tal/@monarchjuno/reviewer-tal",
      tags: ["tal"],
      content: "tal content",
    });
    await writeAsset(cwd, "dance/@monarchjuno/reviewer-dance", {
      type: "dance/@monarchjuno/reviewer-dance",
      tags: ["dance"],
      content: "dance content",
    });
    await writeAsset(cwd, "performer/@monarchjuno/reviewer", {
      type: "performer/@monarchjuno/reviewer",
      tags: ["performer"],
      tal: "tal/@monarchjuno/reviewer-tal",
      dance: ["dance/@monarchjuno/reviewer-dance"],
    });

    const deps = await resolveDependencies(
      cwd,
      "act",
      {
        type: "act/@monarchjuno/smoke-act",
        entryNode: "worker",
        nodes: {
          worker: {
            type: "worker",
            performer: "performer/@monarchjuno/reviewer",
          },
        },
        edges: [],
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
