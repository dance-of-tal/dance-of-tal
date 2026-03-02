import path from "path";
import { describe, expect, it } from "vitest";
import {
  assertPathInside,
  assertSafeAssetUrn,
  assertSafeComboName,
  assertSafeRunId,
} from "./identifiers.js";

describe("identifiers safety", () => {
  it("accepts valid combo and run identifiers", () => {
    expect(() => assertSafeComboName("pr-review_v2")).not.toThrow();
    expect(() => assertSafeRunId("run-20260301:agent-a")).not.toThrow();
  });

  it("rejects unsafe combo and run identifiers", () => {
    expect(() => assertSafeComboName("../escape")).toThrow("Invalid combo name");
    expect(() => assertSafeRunId("../../etc")).toThrow("Invalid runId");
  });

  it("validates asset urn format", () => {
    expect(() => assertSafeAssetUrn("tal/@dot-presets/system-architect")).not.toThrow();
    expect(() => assertSafeAssetUrn("tal/@dot-presets/../bad")).toThrow();
  });

  it("blocks path traversal attempts", () => {
    const base = path.resolve("/tmp/base");
    expect(() => assertPathInside(base, path.resolve("/tmp/base/child"), "test")).not.toThrow();
    expect(() => assertPathInside(base, path.resolve("/tmp/other"), "test")).toThrow(
      "Unsafe test path resolution attempted."
    );
  });
});
