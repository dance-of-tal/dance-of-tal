import path from "path";
import { describe, expect, it } from "vitest";
import {
  assertPathInside,
  assertSafeAssetUrn,
} from "./identifiers.js";

describe("identifiers safety", () => {
  it("validates 4-segment asset urn format", () => {
    expect(() => assertSafeAssetUrn("tal/@acme/agent-presets/system-architect")).not.toThrow();
    expect(() => assertSafeAssetUrn("performer/@acme/workflows/sprint")).not.toThrow();
    expect(() => assertSafeAssetUrn("act/@acme/pipelines/incident")).not.toThrow();
    expect(() => assertSafeAssetUrn("dance/@acme/frontend-skills/code-review")).not.toThrow();
    expect(() => assertSafeAssetUrn("tal/@acme/../bad/name")).toThrow();
    expect(() => assertSafeAssetUrn("invalid-kind/@acme/stage/name")).toThrow();
    expect(() => assertSafeAssetUrn("tal/acme/stage/name")).toThrow(); // missing @
    expect(() => assertSafeAssetUrn("tal/@acme/name")).toThrow(); // 3-segment (legacy)
  });

  it("blocks path traversal attempts", () => {
    const base = path.resolve("/tmp/base");
    expect(() => assertPathInside(base, path.resolve("/tmp/base/child"), "test")).not.toThrow();
    expect(() => assertPathInside(base, path.resolve("/tmp/other"), "test")).toThrow(
      "Unsafe test path resolution attempted."
    );
  });
});
