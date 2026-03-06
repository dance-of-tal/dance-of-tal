import path from "path";
import { describe, expect, it } from "vitest";
import {
  assertPathInside,
  assertSafeAssetUrn,
  assertSafePerformerName,
  assertSafeRunId,
} from "./identifiers.js";

describe("identifiers safety", () => {
  it("accepts valid performer and run identifiers", () => {
    expect(() => assertSafePerformerName("pr-review_v2")).not.toThrow();
    expect(() => assertSafeRunId("run-20260301:agent-a")).not.toThrow();
  });

  it("rejects unsafe performer and run identifiers", () => {
    expect(() => assertSafePerformerName("../escape")).toThrow("Invalid performer name");
    expect(() => assertSafeRunId("../../etc")).toThrow("Invalid runId");
  });

  it("validates asset urn format", () => {
    expect(() => assertSafeAssetUrn("tal/@acme/system-architect")).not.toThrow();
    expect(() => assertSafeAssetUrn("tal/@acme/../bad")).toThrow();
  });

  it("blocks path traversal attempts", () => {
    const base = path.resolve("/tmp/base");
    expect(() => assertPathInside(base, path.resolve("/tmp/base/child"), "test")).not.toThrow();
    expect(() => assertPathInside(base, path.resolve("/tmp/other"), "test")).toThrow(
      "Unsafe test path resolution attempted."
    );
  });
});
