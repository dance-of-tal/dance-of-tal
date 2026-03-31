import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assetFilePath, initRegistry } from "../../lib/registry.js";
import { loadPublishPayload, resolveTagsOption } from "./publish.js";
import {
  buildPublishPlan,
  executePublishPlan,
  resolveDependencies,
} from "../../lib/publishing.js";

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
    await writeAsset(cwd, "performer/@acme/agent-presets/smoke-performer", {
      kind: "performer",
      urn: "performer/@acme/agent-presets/smoke-performer",
      description: "Smoke performer",
      tags: ["review"],
      payload: {
        tal: "tal/@acme/agent-presets/reviewer",
      },
    });

    const payload = await loadPublishPayload(cwd, "performer", "agent-presets", "smoke-performer", "acme");
    expect(payload.urn).toBe("performer/@acme/agent-presets/smoke-performer");
    expect(payload.tags).toEqual(["review"]);
  });

  it("resolves performer dependencies from authored assets instead of lockfiles", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } })
    );

    await writeAsset(cwd, "tal/@acme/agent-presets/reviewer-tal", {
      kind: "tal",
      urn: "tal/@acme/agent-presets/reviewer-tal",
      tags: ["tal"],
      payload: {
        content: "tal content",
      },
    });
    await writeAsset(cwd, "performer/@acme/agent-presets/reviewer", {
      kind: "performer",
      urn: "performer/@acme/agent-presets/reviewer",
      tags: ["performer"],
      payload: {
        tal: "tal/@acme/agent-presets/reviewer-tal",
      },
    });

    const deps = await resolveDependencies(
      cwd,
      "act",
      {
        kind: "act",
        urn: "act/@acme/workflows/smoke-act",
        description: "test act",
        tags: [],
        payload: {
          participants: [
            {
              key: "worker",
              performer: "performer/@acme/agent-presets/reviewer",
            },
          ],
          relations: [],
        },
      },
      "acme"
    );

    expect(deps.filter((dep) => dep.status === "to_publish").map((dep) => dep.urn)).toEqual([
      "tal/@acme/agent-presets/reviewer-tal",
      "performer/@acme/agent-presets/reviewer",
    ]);
  });

  it("uses payload tags when no publish tags are provided", () => {
    expect(resolveTagsOption(undefined, { tags: ["review", "backend"] })).toEqual(["review", "backend"]);
    expect(resolveTagsOption("frontend, react ", { tags: ["ignored"] })).toEqual(["frontend", "react"]);
  });

  it("supports in-memory provided assets for draft-style cascade publish", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } })
    );

    const plan = await buildPublishPlan({
      cwd,
      username: "acme",
      root: {
        kind: "performer",
        urn: "performer/@acme/agent-presets/reviewer",
        payload: {
          kind: "performer",
          urn: "performer/@acme/agent-presets/reviewer",
          description: "Review performer",
          tags: ["performer"],
          payload: {
            tal: "tal/@acme/agent-presets/reviewer-tal",
          },
        },
      },
      providedAssets: {
        "tal/@acme/agent-presets/reviewer-tal": {
          kind: "tal",
          urn: "tal/@acme/agent-presets/reviewer-tal",
          payload: {
            kind: "tal",
            urn: "tal/@acme/agent-presets/reviewer-tal",
            description: "Review tal",
            tags: ["tal"],
            payload: {
              content: "tal content",
            },
          },
        },
      },
    });

    expect(plan.dependencies.map((dep) => ({ urn: dep.urn, status: dep.status, source: dep.source }))).toEqual([
      {
        urn: "tal/@acme/agent-presets/reviewer-tal",
        status: "to_publish",
        source: "provided",
      },
    ]);
    expect(plan.publishQueue.map((entry) => entry.urn)).toEqual([
      "tal/@acme/agent-presets/reviewer-tal",
    ]);
  });

  it("rejects foreign missing dependencies in the publish plan", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } })
    );

    const plan = await buildPublishPlan({
      cwd,
      username: "acme",
      root: {
        kind: "performer",
        urn: "performer/@acme/agent-presets/reviewer",
        payload: {
          kind: "performer",
          urn: "performer/@acme/agent-presets/reviewer",
          description: "Review performer",
          tags: ["performer"],
          payload: {
            tal: "tal/@other/agent-presets/reviewer-tal",
          },
        },
      },
    });

    expect(plan.foreignMissing).toEqual(["tal/@other/agent-presets/reviewer-tal"]);
    await expect(executePublishPlan(plan, "token")).rejects.toThrow("belong to other authors");
  });

  it("rejects local missing dependencies in the publish plan", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } })
    );

    const plan = await buildPublishPlan({
      cwd,
      username: "acme",
      root: {
        kind: "performer",
        urn: "performer/@acme/agent-presets/reviewer",
        payload: {
          kind: "performer",
          urn: "performer/@acme/agent-presets/reviewer",
          description: "Review performer",
          tags: ["performer"],
          payload: {
            tal: "tal/@acme/agent-presets/reviewer-tal",
          },
        },
      },
    });

    expect(plan.localMissing).toEqual(["tal/@acme/agent-presets/reviewer-tal"]);
    await expect(executePublishPlan(plan, "token")).rejects.toThrow("not found locally");
  });

  it("rejects dance assets as provided publish dependencies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } })
    );

    await expect(buildPublishPlan({
      cwd,
      username: "acme",
      root: {
        kind: "performer",
        urn: "performer/@acme/agent-presets/reviewer",
        payload: {
          kind: "performer",
          urn: "performer/@acme/agent-presets/reviewer",
          description: "Review performer",
          tags: ["performer"],
          payload: {
            dances: ["dance/@acme/frontend-skills/review-skill"],
          },
        },
      },
      providedAssets: {
        "dance/@acme/frontend-skills/review-skill": {
          kind: "dance" as never,
          urn: "dance/@acme/frontend-skills/review-skill",
          payload: {
            kind: "dance",
            urn: "dance/@acme/frontend-skills/review-skill",
            description: "Review skill",
            payload: {
              name: "review-skill",
              description: "Review skill",
              content: "body",
            },
          },
        },
      },
    })).rejects.toThrow("Publish only supports tal, performer, and act URNs");
  });
});
