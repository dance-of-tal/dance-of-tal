import { describe, expect, it } from "vitest";

import {
  parseActAsset,
  parseDotAsset,
  parsePerformerAsset,
  parseTalAsset,
  projectRegistryMetadata,
} from "./index.js";

describe("dot contracts", () => {
  it("parses a tal asset with raw markdown content", () => {
    const asset = parseTalAsset({
      kind: "tal",
      urn: "tal/@acme/agent-presets/senior-backend",
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
      kind: "performer",
      urn: "performer/@acme/agent-presets/reviewer",
      tags: ["review"],
      payload: {
        tal: "tal/@acme/agent-presets/senior-backend",
        dances: ["dance/@acme/frontend-skills/code-review"],
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
        kind: "performer",
        urn: "performer/@acme/agent-presets/reviewer",
        payload: {},
      }),
    ).toThrow("payload must include at least one of tal or dances");
  });

  it("parses an act asset with participant subscriptions and relations", () => {
    const asset = parseActAsset({
      kind: "act",
      urn: "act/@acme/workflows/review-pipeline",
      payload: {
        actRules: ["Lead owns final approval."],
        participants: [
          {
            key: "lead",
            performer: "performer/@acme/agent-presets/reviewer",
            subscriptions: {
              callboardKeys: ["shared/*"],
            },
          },
          {
            key: "worker",
            performer: "performer/@acme/agent-presets/reviewer",
          },
        ],
        relations: [
          {
            between: ["lead", "worker"],
            name: "review_request",
            direction: "one-way",
            description: "Lead sends review requests to worker",
          },
        ],
      },
    });

    expect(asset.payload.participants).toHaveLength(2);
    expect(asset.payload.relations[0]?.description).toBe("Lead sends review requests to worker");
  });

  it("rejects legacy act participant and relation fields", () => {
    expect(() =>
      parseActAsset({
        kind: "act",
        urn: "act/@acme/workflows/review-pipeline",
        payload: {
          participants: [
            {
              id: "lead",
              performer: "performer/@acme/agent-presets/reviewer",
            },
          ],
          relations: [],
        },
      }),
    ).toThrow("payload.participants[0].id is not supported");

    expect(() =>
      parseActAsset({
        kind: "act",
        urn: "act/@acme/workflows/review-pipeline",
        payload: {
          participants: [
            {
              key: "lead",
              performer: "performer/@acme/agent-presets/reviewer",
              activeDances: ["dance/@acme/frontend-skills/code-review"],
            },
          ],
          relations: [],
        },
      }),
    ).toThrow("payload.participants[0].activeDances is not supported");

    expect(() =>
      parseActAsset({
        kind: "act",
        urn: "act/@acme/workflows/review-pipeline",
        payload: {
          participants: [
            {
              key: "lead",
              performer: "performer/@acme/agent-presets/reviewer",
            },
          ],
          relations: [
            {
              between: ["lead", "lead"],
              direction: "one-way",
              name: "review_request",
              description: "Lead self-review",
              maxCalls: 10,
            },
          ],
        },
      }),
    ).toThrow("payload.relations[0].maxCalls is not supported");
  });

  it("rejects legacy top-level $schema fields on canonical assets", () => {
    expect(() =>
      parseTalAsset({
        $schema: "https://schemas.danceoftal.com/assets/tal.v1.json",
        kind: "tal",
        urn: "tal/@acme/agent-presets/senior-backend",
        payload: {
          content: "# agent.md",
        },
      }),
    ).toThrow("$schema is not supported in canonical assets");

    expect(() =>
      parsePerformerAsset({
        $schema: "https://schemas.danceoftal.com/assets/performer.v1.json",
        kind: "performer",
        urn: "performer/@acme/agent-presets/reviewer",
        payload: {
          tal: "tal/@acme/agent-presets/senior-backend",
        },
      }),
    ).toThrow("$schema is not supported in canonical assets");

    expect(() =>
      parseActAsset({
        $schema: "https://schemas.danceoftal.com/assets/act.v1.json",
        kind: "act",
        urn: "act/@acme/workflows/review-pipeline",
        payload: {
          participants: [
            {
              key: "lead",
              performer: "performer/@acme/agent-presets/reviewer",
            },
          ],
          relations: [],
        },
      }),
    ).toThrow("$schema is not supported in canonical assets");

    expect(() =>
      parseDotAsset({
        $schema: "https://schemas.danceoftal.com/assets/dance.v1.json",
        kind: "dance",
        urn: "dance/@acme/frontend-skills/code-review",
        payload: {
          name: "code-review",
          description: "Code review skill",
          content: "# skill.md",
        },
      }),
    ).toThrow("$schema is not supported in canonical assets");
  });

  it("projects compact registry metadata from an asset", () => {
    const asset = parseDotAsset({
      kind: "dance",
      urn: "dance/@acme/frontend-skills/code-review",
      tags: ["review", "quality"],
      payload: {
        name: "code-review",
        description: "Code review skill",
        content: "# skill.md",
      },
    });

    expect(projectRegistryMetadata(asset)).toEqual({
      urn: "dance/@acme/frontend-skills/code-review",
      kind: "dance",
      owner: "@acme",
      name: "code-review",
      tags: ["review", "quality"],
    });
  });
});
