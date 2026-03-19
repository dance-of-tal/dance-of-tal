import path from "path";
import { describe, expect, it } from "vitest";
import {
  assertPathInside,
  assertSafeAssetUrn,
} from "./identifiers.js";

describe("identifiers safety", () => {
  it("validates asset urn format", () => {
    expect(() => assertSafeAssetUrn("tal/@acme/system-architect")).not.toThrow();
    expect(() => assertSafeAssetUrn("performer/@acme/sprint")).not.toThrow();
    expect(() => assertSafeAssetUrn("act/@acme/incident")).not.toThrow();
    expect(() => assertSafeAssetUrn("tal/@acme/../bad")).toThrow();
    expect(() => assertSafeAssetUrn("invalid-kind/@acme/name")).toThrow();
    expect(() => assertSafeAssetUrn("tal/acme/name")).toThrow(); // missing @
  });

  it("blocks path traversal attempts", () => {
    const base = path.resolve("/tmp/base");
    expect(() => assertPathInside(base, path.resolve("/tmp/base/child"), "test")).not.toThrow();
    expect(() => assertPathInside(base, path.resolve("/tmp/other"), "test")).toThrow(
      "Unsafe test path resolution attempted."
    );
  });
});
