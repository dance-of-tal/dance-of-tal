import { describe, expect, it } from "vitest";

import {
  ACT_ASSET_SCHEMA,
  DANCE_ASSET_SCHEMA,
  parseActAsset,
  parseDotAsset,
  parsePerformerAsset,
  parseTalAsset,
  PERFORMER_ASSET_SCHEMA,
  projectRegistryMetadata,
  TAL_ASSET_SCHEMA,
} from "./index.js";

describe("dot contracts", () => {
  it("parses a tal asset with raw markdown content", () => {
    const asset = parseTalAsset({
      $schema: TAL_ASSET_SCHEMA,
      kind: "tal",
      urn: "tal/@acme/senior-backend",
      description: "Backend posture",
      tags: ["backend"],
      payload: {
        content: "# agent.md",
      },
    });

    expect(asset.payload.content).toBe("# agent.md");
  });

  it("parses a performer asset with portable MCP requirements", () => {
    const asset = parsePerformerAsset({
      $schema: PERFORMER_ASSET_SCHEMA,
      kind: "performer",
      urn: "performer/@acme/reviewer",
      tags: ["review"],
      payload: {
        tal: "tal/@acme/senior-backend",
        dances: ["dance/@acme/code-review"],
        model: {
          provider: "anthropic",
          modelId: "claude-sonnet-4",
        },
        modelVariant: "normal",
        mcp_config: {
          servers: {
            github: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-github"],
            },
          },
        },
      },
    });

    expect((asset.payload.mcp_config as any)?.servers?.github?.command).toBe("npx");
  });

  it("rejects performer assets without tal or dances", () => {
    expect(() =>
      parsePerformerAsset({
        $schema: PERFORMER_ASSET_SCHEMA,
        kind: "performer",
        urn: "performer/@acme/reviewer",
        payload: {},
      }),
    ).toThrow("payload must include at least one of tal or dances");
  });

  it("parses an act asset with participant subscriptions and relation policy", () => {
    const asset = parseActAsset({
      $schema: ACT_ASSET_SCHEMA,
      kind: "act",
      urn: "act/@acme/review-pipeline",
      payload: {
        actRules: ["Lead owns final approval."],
        participants: [
          {
            id: "lead",
            performer: "performer/@acme/reviewer",
            subscriptions: {
              callboardKeys: ["shared/*"],
            },
          },
          {
            id: "worker",
            performer: "performer/@acme/reviewer",
            activeDances: ["dance/@acme/code-review"],
          },
        ],
        relations: [
          {
            id: "lead-worker",
            between: ["lead", "worker"],
            name: "review_request",
            direction: "one-way",
            sessionPolicy: "reuse",
          },
        ],
      },
    });

    expect(asset.payload.participants).toHaveLength(2);
    expect(asset.payload.relations[0]?.sessionPolicy).toBe("reuse");
  });

  it("projects compact registry metadata from an asset", () => {
    const asset = parseDotAsset({
      $schema: DANCE_ASSET_SCHEMA,
      kind: "dance",
      urn: "dance/@acme/code-review",
      tags: ["review", "quality"],
      payload: {
        content: "# skill.md",
      },
    });

    expect(projectRegistryMetadata(asset)).toEqual({
      urn: "dance/@acme/code-review",
      kind: "dance",
      author: "@acme",
      slug: "code-review",
      tags: ["review", "quality"],
    });
  });
});
